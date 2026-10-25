import { watch,type FSWatcher } from 'chokidar'
import { relative } from 'node:path'
export async function watchArchive(root:string,onChange:(paths:string[])=>void,onError:(error:unknown)=>void=()=>{}){
 const pending=new Set<string>();let timer:ReturnType<typeof setTimeout>|undefined,watcher:FSWatcher,closed=false,switching=false
 let resolveReady!:()=>void,rejectReady!:(error:unknown)=>void
 const ready=new Promise<void>((resolve,reject)=>{resolveReady=resolve;rejectReady=reject})
 const start=(polling:boolean)=>{
  const current=watch(root,{ignoreInitial:true,usePolling:polling,interval:1000,binaryInterval:2000,ignored:p=>/(^|[\\/])(\.git|\.aia)([\\/]|$)|\.aia-tmp-/.test(p),awaitWriteFinish:{stabilityThreshold:100,pollInterval:30}});watcher=current
  current.on('all',(_event,path)=>{pending.add(relative(root,path));clearTimeout(timer);timer=setTimeout(()=>{const paths=[...pending];pending.clear();if(!closed)onChange(paths)},100)})
  current.on('error',error=>{if(closed)return;if(!polling){if(switching)return;switching=true;current.close().then(()=>{if(!closed)start(true)}).catch(rejectReady)}else{rejectReady(error);onError(error)}})
  current.once('ready',resolveReady)
 }
 start(false);await ready
 return async()=>{closed=true;clearTimeout(timer);await watcher.close()}
}
