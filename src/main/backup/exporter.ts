import { createWriteStream } from 'node:fs'
import { mkdtemp,mkdir,copyFile,stat,open,rename,rm,readFile } from 'node:fs/promises'
import { join,dirname,relative,isAbsolute,resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { ZipFile } from 'yazl'
import { parse } from 'yaml'
import type { ArchiveRepository } from '../archive/repository'
import type { SyncCoordinator } from '../sync/coordinator'
import type { OperationGate } from '../operation-gate'
import { safePath,walkFiles } from '../archive/paths'
import { atomicWrite } from '../archive/transactions'
import { fileHash,validateNames } from './manifest'
import { inspectBackup,restoreBackup,type BackupLimits } from './restorer'
import type { BackupManifest,BackupEntry,BackupReceipt } from '../../shared/backup'
import { SyncJournal } from '../sync/journal'
interface Options extends BackupLimits{publicSettings?:()=>Promise<unknown>;onSnapshot?:()=>void}
const within=(path:string,root:string)=>{const r=relative(root,path);return!r||(!r.startsWith('..')&&!isAbsolute(r))}
export class BackupService{
 constructor(private repo:ArchiveRepository,private coordinator:SyncCoordinator,private gate:OperationGate,private options:Options={}){}
 inspect(file:string){return inspectBackup(file,this.options)}
 restore(file:string,target:string,expectedFingerprint?:string){return restoreBackup(file,target,{archiveRoot:this.repo.root,stateRoot:this.repo.stateRoot},this.options,expectedFingerprint)}
 export(destination:string):Promise<BackupReceipt>{const file=resolve(destination);if(within(file,this.repo.root)||within(file,this.repo.stateRoot))return Promise.reject(Error('备份应保存到当前档案与运行状态目录之外'));return this.gate.freeze(async()=>{
  await this.coordinator.idle();await this.repo.transactions.idle();try{const catalog=JSON.parse(await readFile(await safePath(this.repo.root,'.aia/catalog.json'),'utf8'));if(catalog.archiveId!==this.repo.info.archiveId||catalog.schemaVersion!==1)throw Error('档案身份变化');const disk=new SyncJournal(this.repo.stateRoot,this.repo.info.archiveId);await disk.open();for(const n of Object.values(disk.getState().graph)){const hash=n.state.kind==='present'?n.state.hash:n.state.priorHash;if(hash)await disk.verifyObject(hash)}}catch{throw Error('同步历史或必要对象无法校验，尚未生成完整备份；请先保留本机档案并恢复有效历史。')}
  const stage=await mkdtemp(join(dirname(file),'.aia-backup-')),zipPath=join(stage,'complete.zip'),snapshot=join(stage,'snapshot'),manifest:BackupManifest={schemaVersion:1,appVersion:'0.1.0',archiveId:this.repo.info.archiveId,createdAt:new Date().toISOString(),entries:[],records:[],attachments:[],excluded:['credentials/','cache/','SQLite及WAL','.git/','临时文件与进程锁'],notes:['包含当前工作文件，不包含完整Git提交历史。','恢复保留原档案，旧发布队列隔离，必须重新比较后才能继续发布。']}
  const sources:{source:string;path:string;signature:string}[]=[],sets:{root:string;prefix:string;paths:string[]}[]=[]
  const signature=async(path:string)=>{const s=await stat(path,{bigint:true});return[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':')}
  async function prefix(path:string){const f=await open(path,'r');try{const b=Buffer.alloc(65536),r=await f.read(b,0,b.length,0);return b.subarray(0,r.bytesRead).toString()}finally{await f.close()}}
  const add=async(source:string,path:string)=>{const before=await signature(source),target=await safePath(snapshot,path);await mkdir(dirname(target),{recursive:true});await copyFile(source,target);const row:BackupEntry={path,size:(await stat(target)).size,hash:await fileHash(target)};if(await signature(source)!==before)throw Error('备份期间源文件变化，请重新导出');manifest.entries.push(row);sources.push({source,path,signature:before});if(path.startsWith('archive/')&&path.endsWith('.md')){try{const value=await prefix(target),meta=value.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/),id=meta?parse(meta[1])?.aia_id:null;if(typeof id==='string')manifest.records.push({id,path})}catch{/* preserve ordinary files */}}if(path.startsWith('archive/.aia/attachments/')&&path.endsWith('.json')){const value=JSON.parse(await prefix(target));if(typeof value.id==='string'&&typeof value.path==='string')manifest.attachments.push({id:value.id,path:'archive/'+value.path})}}
  try{
   await mkdir(snapshot,{recursive:true});const archivePaths=await walkFiles(this.repo.root,true);sets.push({root:this.repo.root,prefix:'archive/',paths:archivePaths});for(const path of archivePaths)await add(await safePath(this.repo.root,path),'archive/'+path)
   for(const dir of ['objects','transactions','sync','drafts','request-budgets']){const root=await safePath(this.repo.stateRoot,'state/'+dir);let paths:string[];try{paths=await walkFiles(root,true)}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')continue;throw e}sets.push({root,prefix:'state/state/'+dir+'/',paths});for(const path of paths)await add(await safePath(root,path),'state/state/'+dir+'/'+path)}
   if(this.options.publicSettings){const value=await this.options.publicSettings()as {endpoints?:Record<string,{config?:Record<string,unknown>}>},endpoints:Record<string,unknown>={};for(const id of ['webdav','github']){const input=value.endpoints?.[id]?.config,config=input?Object.fromEntries((id==='webdav'?['id','url','username']:['id','owner','repo','branch']).filter(k=>Object.hasOwn(input,k)).map(k=>[k,input[k]])):null;endpoints[id]={id,config,enabled:false,status:config?'disabled':'not_configured',verifiedAt:null,revision:0}}const path='state/settings/connections.json',target=join(snapshot,path);await atomicWrite(target,JSON.stringify({schemaVersion:1,endpoints}));manifest.entries.push({path,size:(await stat(target)).size,hash:await fileHash(target)})}
   manifest.entries.sort((a,b)=>a.path.localeCompare(b.path));validateNames(manifest.entries.map(e=>e.path));this.options.onSnapshot?.();for(const s of sources)if(await signature(s.source)!==s.signature)throw Error('源文件在快照期间变化，请重新导出');for(const s of sets)if(JSON.stringify(await walkFiles(s.root,true))!==JSON.stringify(s.paths))throw Error('源文件清单在快照期间变化，请重新导出')
   const zip=new ZipFile(),done=pipeline(zip.outputStream,createWriteStream(zipPath,{flags:'wx',mode:0o600}));zip.addBuffer(Buffer.from(JSON.stringify(manifest,null,2)),'manifest.json');for(const e of manifest.entries)zip.addFile(join(snapshot,e.path),e.path);zip.end();await done;const zipped=await open(zipPath,'r+');try{await zipped.sync()}finally{await zipped.close()}const checked=await inspectBackup(zipPath,this.options),bytes=(await stat(zipPath)).size;await rename(zipPath,file);const parent=await open(dirname(file),'r');try{await parent.sync()}finally{await parent.close()};return{file,createdAt:manifest.createdAt,files:manifest.entries.length,bytes,hash:checked.fingerprint}
  }finally{await rm(stage,{recursive:true,force:true})}
 })}
}
