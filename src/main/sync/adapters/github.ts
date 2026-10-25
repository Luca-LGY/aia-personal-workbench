import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { open,stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { join } from 'node:path'
import { parse } from 'yaml'
import type { EndpointAdapter,ScanResult,RemoteEntry,ChangeBatch,EndpointReceipt } from '../../../shared/sync'
import { atomicWrite,readMaybe } from '../../archive/transactions'
import { digest } from '../graph'
import { SyncError } from '../errors'
import { RequestBudget } from '../request-budget'
import { responseChunks,type SyncObjectStore } from '../streams'
import type { Transport,RequestOptions } from '../transport'
interface Options{owner:string;repo:string;branch:string;getSecret():Promise<string>;stateRoot:string;objectStore:SyncObjectStore;budget:RequestBudget;apiBase?:string;allowTestHTTP?:boolean;transport?:Transport}
interface TreeRow{path:string;type:string;mode:string;sha:string;size?:number}
interface Commit{sha:string;tree:{sha:string};parents:{sha:string}[]}
interface Pending{fingerprint:string;parent:string;tree:string;commitBody:Record<string,unknown>;commit?:string;published?:boolean}
const validSHA=(v:string)=>/^[a-f0-9]{40}$/.test(v)
export class GithubAdapter implements EndpointAdapter{
 readonly id='github' as const;readonly namespace:string;private base:string;private transport:Transport;private tail:Promise<unknown>=Promise.resolve();private cache:Record<string,RemoteEntry>={};private lastHead='';private loaded=false;private lastComplete=false
 constructor(private c:Options){
  const url=new URL(c.apiBase??'https://api.github.com');if((url.protocol!=='https:'&&!(c.allowTestHTTP&&url.protocol==='http:'&&url.hostname==='127.0.0.1'))||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('无效 GitHub API 地址')
  if(!/^[\w.-]+$/.test(c.owner)||!/^[\w.-]+$/.test(c.repo)||!c.branch||/[\s\\~^:?*[]/.test(c.branch)||[...c.branch].some(v=>v.charCodeAt(0)<32)||c.branch.includes('..')||c.branch.includes('@{'))throw Error('无效 GitHub 仓库或分支')
  this.base=url.origin;this.transport=c.transport??fetch;this.namespace='github:'+digest(this.base+'\0'+c.owner+'/'+c.repo+'\0'+c.branch)
 }
 private queue<T>(fn:()=>Promise<T>){const task=this.tail.then(fn);this.tail=task.catch(()=>{});return task}
 private repo(){return '/repos/'+encodeURIComponent(this.c.owner)+'/'+encodeURIComponent(this.c.repo)}
 private path(path:string){if(!path||path.startsWith('/')||path.includes('\\')||path.includes('\0')||path.split('/').some(v=>!v||v==='.'||v==='..'))throw new SyncError('unsupported','不安全档案路径');return path}
 private cachePath(){return join(this.c.stateRoot,'cache/github',digest(this.namespace)+'.json')}
 private pendingPath(id:string){if(!/^[a-f0-9]{64}$/.test(id))throw Error('无效批次');return join(this.c.stateRoot,'state/sync/github',digest(this.namespace),id+'.json')}
 private async load(){if(this.loaded)return;const raw=await readMaybe(this.cachePath());if(raw)try{const v=JSON.parse(raw.toString());this.cache=v.blobs??{};this.lastHead=v.head??''}catch{this.cache={}}this.loaded=true}
 private async persist(){await atomicWrite(this.cachePath(),JSON.stringify({blobs:this.cache,head:this.lastHead}))}
 private async request(path:string,method='GET',body?:RequestOptions['body'],raw=false){
  await this.c.budget.reserve();let response:Response
  try{response=await this.transport(this.base+path,{method,headers:{Authorization:'Bearer '+await this.c.getSecret(),Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10',...(body?{'Content-Type':'application/json'}:{})},body,redirect:'error',signal:AbortSignal.timeout(30000),...(body instanceof Readable?{duplex:'half' as const}:{})})}catch{throw new SyncError(method==='GET'?'offline':'outcome_unknown','GitHub 网络响应未确认')}
  if(response.status===429||((response.status===403||response.status===503)&&response.headers.has('retry-after'))){const wait=await this.c.budget.defer(response.headers.get('retry-after'));await response.body?.cancel();throw new SyncError('rate_limited','GitHub 要求稍后重试',wait)}
  if(!response.ok){const code=response.status===401||response.status===403?'unauthorized':response.status===404?'not_found':response.status===409||response.status===422?'conflict':response.status>=500?'offline':'unsupported';await response.body?.cancel();throw new SyncError(code,'GitHub 请求失败：'+response.status)}return response
 }
 private async json<T>(path:string,method='GET',body?:unknown){return await(await this.request(path,method,body===undefined?undefined:JSON.stringify(body))).json() as T}
 private async head(){const r=await this.json<{object:{sha:string}}>(this.repo()+'/git/ref/heads/'+encodeURIComponent(this.c.branch));if(!validSHA(r.object.sha))throw new SyncError('incomplete','分支版本无效');return r.object.sha}
 private async commit(id:string){if(!validSHA(id))throw new SyncError('incomplete','提交版本无效');return this.json<Commit>(this.repo()+'/git/commits/'+id)}
 private async contains(ancestor:string,head:string){const todo=[head],seen=new Set<string>();while(todo.length&&seen.size<2000){const next=todo.pop()!;if(next===ancestor)return true;if(seen.has(next))continue;seen.add(next);todo.push(...(await this.commit(next)).parents.map(p=>p.sha))}if(todo.length)throw new SyncError('incomplete','提交历史超出本轮可核对范围');return false}
 private async rows(tree:string){
  const read=(sha:string,recursive=false)=>this.json<{tree:TreeRow[];truncated:boolean}>(this.repo()+'/git/trees/'+sha+(recursive?'?recursive=1':''))
  const all=await read(tree,true);if(!all.truncated)return all.tree
  const result:TreeRow[]=[],walk=async(sha:string,prefix:string,ancestors:Set<string>)=>{if(ancestors.has(sha)||ancestors.size>100)throw new SyncError('incomplete','树结构循环或过深');const v=await read(sha);if(v.truncated)throw new SyncError('incomplete','非递归树仍被截断');for(const r of v.tree){const path=prefix+r.path;this.path(path);if(r.type==='tree')await walk(r.sha,path+'/',new Set([...ancestors,sha]));else result.push({...r,path})}};await walk(tree,'',new Set());return result
 }
 private async prefix(hash:string){const f=await open(await this.c.objectStore.objectPath(hash),'r');try{const bytes=Buffer.alloc(65536),r=await f.read(bytes,0,bytes.length,0);return bytes.subarray(0,r.bytesRead).toString()}finally{await f.close()}}
 private async blob(row:TreeRow):Promise<RemoteEntry>{
  if(!validSHA(row.sha)||row.size===undefined||row.size<0||row.size>100000000)throw new SyncError('unsupported','文件大小或 blob SHA 超出接口能力')
  const cached=this.cache[row.sha];if(cached?.size===row.size&&await this.c.objectStore.hasObject(cached.hash))return{...cached,path:row.path}
  const response=await this.request(this.repo()+'/git/blobs/'+row.sha,'GET',undefined,true),git=createHash('sha1').update(`blob ${row.size}\0`);let size=0
  async function* chunks(){for await(const b of responseChunks(response.body)){git.update(b);size+=b.byteLength;yield b}}
  const value=await this.c.objectStore.ingest(chunks());if(size!==row.size||git.digest('hex')!==row.sha)throw new SyncError('incomplete','blob 内容、长度或 SHA 不符')
  const prefix=await this.prefix(value.hash);if(prefix.startsWith('version https://git-lfs.github.com/spec/v1\n'))throw new SyncError('unsupported','LFS 指针缺少原件')
  let recordId:string|undefined;try{const match=prefix.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/),meta=match?parse(match[1]):null;if(typeof meta?.aia_id==='string')recordId=meta.aia_id}catch{/* ordinary Markdown */}
  const result={path:row.path,revision:row.sha,hash:value.hash,size,writeSafe:true,...(recordId?{recordId}:{})};this.cache[row.sha]=result;return result
 }
 private async snapshot(head:string){const commit=await this.commit(head),warnings:string[]=[],entries:RemoteEntry[]=[],modes:Record<string,string>={};let rows:TreeRow[]=[]
  try{rows=await this.rows(commit.tree.sha)}catch(e){if(e instanceof SyncError&&e.code==='incomplete')warnings.push(e.message);else throw e}
  const seen=new Set<string>();for(const row of rows){if(row.type==='tree')continue;try{this.path(row.path);if(seen.has(row.path))throw new SyncError('incomplete','重复路径');seen.add(row.path);if(row.type!=='blob'||!['100644','100755'].includes(row.mode))throw new SyncError('unsupported','符号链接或子模块尚不支持');entries.push(await this.blob(row));modes[row.path]=row.mode}catch(e){if(e instanceof SyncError&&['unsupported','incomplete'].includes(e.code))warnings.push(row.path+'：'+e.message);else throw e}}
  return {scan:{complete:!warnings.length,rootExists:true,revision:head,entries,warnings} as ScanResult,tree:commit.tree.sha,modes}
 }
 scan(){return this.queue(async()=>{await this.load();const head=await this.head(),v=await this.snapshot(head);if(this.lastHead&&this.lastHead!==head&&!await this.contains(this.lastHead,head)){v.scan.historyRewritten=true;v.scan.warnings!.push('GitHub 分支历史被改写，旧基线不能作为共同祖先')}
  this.lastComplete=v.scan.complete;if(v.scan.complete)this.lastHead=head;await this.persist();return v.scan})}
 read(path:string,revision:string){return this.queue(async()=>{this.path(path);await this.load();const cached=this.cache[revision];if(!cached||!await this.c.objectStore.hasObject(cached.hash))throw new SyncError('not_found','请先完整扫描该不可变 blob');return this.c.objectStore.object(cached.hash)})}
 private async upload(hash:string){
  const path=await this.c.objectStore.objectPath(hash),size=(await stat(path)).size;if(size>100000000)throw new SyncError('unsupported','文件超过 GitHub blob 能力');const git=createHash('sha1').update(`blob ${size}\0`)
  async function* encoded(){yield '{"encoding":"base64","content":"';let carry=Buffer.alloc(0);for await(const value of createReadStream(path)){const bytes=Buffer.from(value);git.update(bytes);const chunk=Buffer.concat([carry,bytes]),n=chunk.length-chunk.length%3;yield chunk.subarray(0,n).toString('base64');carry=chunk.subarray(n)}if(carry.length)yield carry.toString('base64');yield '"}'}
  const stream=Readable.from(encoded());try{const r=await(await this.request(this.repo()+'/git/blobs','POST',stream as unknown as BodyInit)).json() as {sha:string};if(r.sha!==git.digest('hex'))throw new SyncError('incomplete','上传 blob SHA 核对失败');return r.sha}finally{stream.destroy()}
 }
 apply(batch:ChangeBatch){return this.queue(async()=>{
  if(batch.endpointId!==this.id||batch.namespace!==this.namespace)throw Error('批次目标不匹配');await this.load();const stored=await readMaybe(this.pendingPath(batch.id));let pending:Pending|undefined=stored?JSON.parse(stored.toString()):undefined
  if(pending&&pending.fingerprint!==digest(JSON.stringify(batch)))throw Error('批次内容已变化')
  if(!pending&&!this.lastComplete)throw new SyncError('incomplete','请先完整扫描 GitHub 档案')
  const receipt:EndpointReceipt={batchId:batch.id,endpointId:this.id,namespace:this.namespace,verifiedAt:new Date().toISOString(),complete:false,items:batch.changes.map(c=>({operationId:c.operationId,path:c.path,status:'failed'}))}
  if(!batch.changes.length){receipt.complete=true;receipt.currentRevision=await this.head();return receipt}
  const save=async()=>atomicWrite(this.pendingPath(batch.id),JSON.stringify(pending))
  try{
   if(!pending){const head=await this.head();if(head!==batch.scanRevision)throw new SyncError('conflict','远端分支已经前进，请重新比较');const meta=await this.json<{permissions?:{push?:boolean}}>(this.repo());if(!meta.permissions?.push)throw new SyncError('unauthorized','仓库缺少写入权限');const current=await this.snapshot(head);if(!current.scan.complete)throw new SyncError('incomplete','当前树不完整')
    const tree:TreeRow[]=[];for(const c of batch.changes){this.path(c.path);const old=current.scan.entries.find(e=>e.path===c.path);if(c.expected.type==='absent'?!!old:(!old||old.revision!==c.expected.revision||old.hash!==c.expected.hash))throw new SyncError('conflict','云端文件版本已改变');tree.push({path:c.path,mode:current.modes[c.path]??'100644',type:'blob',sha:c.objectHash?await this.upload(c.objectHash):null as unknown as string})}
    const result=await this.json<{sha:string}>(this.repo()+'/git/trees','POST',{base_tree:current.tree,tree}),user=await this.json<{id:number;login:string;name?:string} >('/user'),date=new Date().toISOString(),identity={name:user.name||user.login,email:`${user.id}+${user.login}@users.noreply.github.com`,date}
    if(!Number.isSafeInteger(user.id)||!user.login)throw new SyncError('unsupported','无法核对提交身份')
    pending={fingerprint:digest(JSON.stringify(batch)),parent:head,tree:result.sha,commitBody:{tree:result.sha,parents:[head],message:'AIA archive sync '+batch.id,author:identity,committer:identity}};await save()
   }
   if(!pending.commit){const r=await this.json<{sha:string}>(this.repo()+'/git/commits','POST',pending.commitBody);if(!validSHA(r.sha))throw new SyncError('incomplete','提交 SHA 无效');pending.commit=r.sha;await save()}
   let head=await this.head(),published=pending.published||await this.contains(pending.commit,head)
   if(!published){if(head!==pending.parent)throw new SyncError('conflict','发布前远端分支已经变化');try{await this.json(this.repo()+'/git/refs/heads/'+encodeURIComponent(this.c.branch),'PATCH',{sha:pending.commit,force:false})}catch(e){head=await this.head();if(!await this.contains(pending.commit,head))throw e}head=await this.head();published=await this.contains(pending.commit,head);if(!published)throw new SyncError('outcome_unknown','提交尚未确认发布')}
   pending.published=true;await save();receipt.committedRevision=pending.commit;receipt.currentRevision=head
   const atCommit=await this.snapshot(pending.commit),current=head===pending.commit?atCommit:await this.snapshot(head);let consistent=current.scan.complete
   receipt.items=batch.changes.map(c=>{const entry=atCommit.scan.entries.find(e=>e.path===c.path),latest=current.scan.entries.find(e=>e.path===c.path),confirmed=atCommit.scan.complete&&(entry?.hash??null)===c.objectHash;if((latest?.hash??null)!==c.objectHash)consistent=false;return{operationId:c.operationId,path:c.path,status:confirmed?'confirmed':'failed',hash:c.objectHash,revision:entry?.revision??null}})
   receipt.complete=consistent&&receipt.items.every(i=>i.status==='confirmed');if(!consistent)receipt.error={code:'conflict',message:'本次提交已发布，当前分支又有修改，需重新比较'};await this.persist()
  }catch(e){const error=e instanceof SyncError?e:new SyncError('offline','GitHub 核对暂未完成');receipt.error={code:error.code,message:error.message,...(error.retryAfterMs?{retryAfterMs:error.retryAfterMs}:{})};receipt.items=receipt.items.map(i=>({...i,status:error.code==='conflict'?'conflict':error.code==='outcome_unknown'?'outcome_unknown':'failed',error:error.message}))}
  return receipt
 })}
}
