import { stat,readFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import type { ScanResult,RemoteEntry } from '../../shared/sync'
import type { ArchiveRepository } from '../archive/repository'
import { safePath,walkFiles } from '../archive/paths'
import { parseDocument } from '../archive/codec'
import { digest } from './graph'
import type { SyncObjectStore } from './streams'
import { ArchivePolicy } from '../archive/policy'
export async function localSnapshot(repo:ArchiveRepository,objects:SyncObjectStore):Promise<ScanResult>{return repo.transactions.exclusive(async()=>{
 const policy=await ArchivePolicy.open(repo.root),allPaths=await walkFiles(repo.root,true),excludedPaths=allPaths.filter(p=>policy.excluded(p)),entries:RemoteEntry[]=[],warnings:string[]=[],paths=allPaths.filter(p=>!policy.excluded(p))
 for(const path of paths){try{const location=await safePath(repo.root,path),before=await stat(location,{bigint:true}),signature=(s:typeof before)=>[s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':'),value=await objects.ingest(createReadStream(location)),after=await stat(location,{bigint:true});if(signature(before)!==signature(after))throw Error('读取期间文件发生变化');let recordId:string|undefined
  if(path.endsWith('.md')&&value.size<2*1024*1024){const p=parseDocument(await readFile(location),path);if(p.status==='record')recordId=p.record.id}
  entries.push({path,hash:value.hash,revision:value.hash,size:value.size,recordId,writeSafe:true})
 }catch{warnings.push(path+'：未获得稳定完整内容')}}
 const after=(await walkFiles(repo.root,true)).filter(p=>!policy.excluded(p));if(JSON.stringify(after)!==JSON.stringify(paths))warnings.push('扫描期间文件清单发生变化')
 return{complete:!warnings.length,rootExists:true,revision:digest(JSON.stringify(entries.map(e=>[e.path,e.hash]))),entries,warnings,excludedPaths}
})}
