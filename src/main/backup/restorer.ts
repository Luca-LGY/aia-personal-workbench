import { open as openZip,type Entry,type ZipFile } from 'yauzl'
import { createHash,randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir,lstat,realpath,rename,rm,readFile,readdir,open } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { join,dirname,basename,resolve,relative,isAbsolute } from 'node:path'
import { ManifestSchema,validateNames,fileHash } from './manifest'
import type { BackupPreview,RestoreReceipt } from '../../shared/backup'
import { safePath } from '../archive/paths'
import { atomicWrite,readMaybe } from '../archive/transactions'
export interface BackupLimits{maxEntries?:number;maxBytes?:number}
async function zipEntries(file:string,maxEntries:number){const zip=await new Promise<ZipFile>((ok,no)=>openZip(file,{lazyEntries:true,autoClose:false,strictFileNames:true,validateEntrySizes:true},(error,value)=>error||!value?no(error??Error('压缩包无法读取')):ok(value))),entries:Entry[]=[]
 try{await new Promise<void>((ok,no)=>{zip.on('error',no);zip.on('end',ok);zip.on('entry',(entry:Entry)=>{entries.push(entry);if(entries.length>maxEntries){no(Error('备份文件数量超过限制'));zip.close()}else zip.readEntry()});zip.readEntry()});return{zip,entries}}catch(e){zip.close();throw e}}
async function stream(zip:ZipFile,entry:Entry){return new Promise<NodeJS.ReadableStream>((ok,no)=>zip.openReadStream(entry,(error,value)=>error||!value?no(error??Error('压缩项无法读取')):ok(value)))}
async function manifestBytes(zip:ZipFile,entry:Entry){if(entry.uncompressedSize>32*1024*1024)throw Error('备份清单超过限制');const chunks:Buffer[]=[];for await(const c of await stream(zip,entry)as AsyncIterable<Buffer>)chunks.push(Buffer.from(c));return Buffer.concat(chunks)}
export async function inspectBackup(file:string,limits:BackupLimits={},stage?:string):Promise<BackupPreview>{
 const {zip,entries}=await zipEntries(file,limits.maxEntries??100000)
 try{
  const names=entries.map(e=>e.fileName);if(new Set(names).size!==names.length)throw Error('压缩包包含重复路径');const manifestEntry=entries.find(e=>e.fileName==='manifest.json');if(!manifestEntry)throw Error('缺少备份清单')
  for(const e of entries){const mode=(e.externalFileAttributes>>>16)&0xf000;if(mode!==0&&mode!==0x8000)throw Error('备份包含非普通文件或符号链接');if(e.fileName.endsWith('/'))throw Error('备份包含未声明目录项')}
  const manifest=ManifestSchema.parse(JSON.parse((await manifestBytes(zip,manifestEntry)).toString()));validateNames(manifest.entries.map(e=>e.path));const expected=new Map(manifest.entries.map(e=>[e.path,e]));if(entries.length!==manifest.entries.length+1)throw Error('备份包含缺失或未声明文件');const totalBytes=manifest.entries.reduce((sum,e)=>sum+e.size,0);if(!Number.isSafeInteger(totalBytes)||totalBytes>(limits.maxBytes??20*1024**3))throw Error('备份解压总量超过限制')
  for(const entry of entries){if(entry===manifestEntry)continue;const row=expected.get(entry.fileName);if(!row||entry.uncompressedSize!==row.size)throw Error('备份清单与文件长度不符');const hash=createHash('sha256');let size=0;const source=await stream(zip,entry)
   async function* chunks(){for await(const chunk of source as AsyncIterable<Buffer>){size+=chunk.length;if(size>row!.size)throw Error('压缩文件实际长度超过限制');hash.update(chunk);yield chunk}}
   if(stage){const path=await safePath(stage,entry.fileName);await mkdir(dirname(path),{recursive:true});await pipeline(chunks(),createWriteStream(path,{flags:'wx',mode:0o600}));const f=await open(path,'r+');try{await f.sync()}finally{await f.close()}}else for await(const _chunk of chunks()){void _chunk}
   if(size!==row.size||hash.digest('hex')!==row.hash)throw Error('备份文件校验失败：'+entry.fileName)
  }
  return{...manifest,file,fingerprint:await fileHash(file),totalBytes}
 }finally{zip.close()}
}
const inside=(path:string,root:string)=>{const rel=relative(root,path);return!rel||(!rel.startsWith('..')&&!isAbsolute(rel))}
async function absent(path:string){try{await lstat(path);throw Error('目标目录已经存在，请选择新目录')}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}}
export async function restoreBackup(file:string,targetInput:string,current:{archiveRoot:string;stateRoot:string},limits:BackupLimits={},expectedFingerprint?:string):Promise<RestoreReceipt>{
 const target=join(await realpath(dirname(resolve(targetInput))),basename(targetInput));for(const root of [current.archiveRoot,current.stateRoot])if(inside(target,root)||inside(root,target))throw Error('恢复目录不能与当前档案或状态目录重叠');await absent(target)
 const preview=await inspectBackup(file,limits);if(expectedFingerprint&&preview.fingerprint!==expectedFingerprint)throw Error('备份文件已变化，请重新检查');const stage=target+'.aia-restore-'+randomUUID();await mkdir(stage,{recursive:false})
 try{
  const verified=await inspectBackup(file,limits,stage);if(verified.fingerprint!==preview.fingerprint)throw Error('备份在恢复期间发生变化');const archiveRoot=join(stage,'archive'),stateRoot=join(stage,'state'),catalog=JSON.parse(await readFile(join(archiveRoot,'.aia/catalog.json'),'utf8'));if(catalog.archiveId!==preview.archiveId||catalog.schemaVersion!==1)throw Error('档案身份与备份清单不符')
  const checkpoint=join(stateRoot,'state/sync',preview.archiveId,'checkpoint.json'),raw=await readMaybe(checkpoint);if(raw){const state=JSON.parse(raw.toString());if(state.schemaVersion!==1||state.archiveId!==preview.archiveId||!state.graph||!state.runs)throw Error('同步历史格式无法恢复');for(const n of Object.values(state.graph)as {state:{kind:string;hash?:string;priorHash?:string|null}}[]){const hash=n.state.kind==='present'?n.state.hash:n.state.priorHash;if(hash){if(!/^[a-f0-9]{64}$/.test(hash)||await fileHash(await safePath(stateRoot,'state/objects/'+hash))!==hash)throw Error('备份缺少有效历史对象')}}for(const run of Object.values(state.runs)as {phase:string}[])if(run.phase==='prepared'||run.phase==='local_applied')run.phase='superseded';state.publishSuspendedForRestore=true;state.revision++;await atomicWrite(checkpoint,JSON.stringify(state))}
  else await atomicWrite(checkpoint,JSON.stringify({schemaVersion:1,archiveId:preview.archiveId,revision:1,graph:{},localHeads:{},baselines:{},conflicts:{},runs:{},publishSuspendedForRestore:true}))
  const github=join(stateRoot,'state/sync/github');try{await rename(github,join(stateRoot,'state/sync/restored-pending-history-'+randomUUID()))}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
  await atomicWrite(join(stateRoot,'settings/archive-ready.json'),JSON.stringify({ready:false}));await atomicWrite(join(stateRoot,'state/sync/restore-generation.json'),JSON.stringify({id:randomUUID(),sourceFingerprint:preview.fingerprint,restoredAt:new Date().toISOString()}))
  const status=join(stateRoot,'state/sync/status.json'),oldStatus=await readMaybe(status);if(oldStatus)await atomicWrite(join(stateRoot,'state/sync/restored-status-history.json'),oldStatus)
  await atomicWrite(status,JSON.stringify({schemaVersion:1,phase:'suspended',lastRunAt:null,localSavedAt:null,setupRequired:true,publishSuspended:true,endpoints:{},conflicts:[],changes:[],warnings:['已恢复本机档案，等待重新连接和比较。']}))
  async function flush(dir:string){for(const e of await readdir(dir,{withFileTypes:true}))if(e.isDirectory())await flush(join(dir,e.name));const f=await open(dir,'r');try{await f.sync()}finally{await f.close()}}await flush(stage);await absent(target);await rename(stage,target);const parent=await open(dirname(target),'r');try{await parent.sync()}finally{await parent.close()}
  return{target,archiveRoot:join(target,'archive'),stateRoot:join(target,'state'),files:preview.entries.length,publishSuspended:true}
 }catch(e){await rm(stage,{recursive:true,force:true});throw e}
}
