import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { createReadStream, type ReadStream } from 'node:fs'
import { open, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { parse } from 'yaml'
import type { CapabilityReport } from '../../../shared/connections'
import type { EndpointAdapter, ScanResult, RemoteEntry, ChangeBatch, EndpointReceipt, RemoteChange } from '../../../shared/sync'
import { atomicWrite, readMaybe } from '../../archive/transactions'
import { validateEndpoint } from '../../connections/probe-service'
import { digest } from '../graph'
import { SyncError } from '../errors'
import { RequestBudget, type SyncClock } from '../request-budget'
import { responseChunks, type SyncObjectStore } from '../streams'
import type { Transport, RequestOptions } from '../transport'
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
const array = (v: unknown): unknown[] => v === undefined ? [] : Array.isArray(v) ? v : [v]
const strong = (v: string) => /^"[^"\r\n]*"$/.test(v)
interface DavOptions { url: string; username: string; getSecret(): Promise<string>; allowTestHTTP?: boolean; stateRoot: string; objectStore: SyncObjectStore; budget: RequestBudget; capabilities: CapabilityReport; transport?: Transport; clock?: SyncClock; requestTimeoutMs?: number; listingLimit?: number;knownPaths?:()=>Promise<string[]> }
interface DavMetadata { path: string; revision: string; size: number }
export class WebdavAdapter implements EndpointAdapter {
  readonly id = 'webdav' as const; readonly namespace: string; private base: URL; private clock: SyncClock; private transport: Transport
  private tail: Promise<unknown> = Promise.resolve(); private authorization = ''; private cache: Record<string, RemoteEntry> = {}; private cacheLoaded = false; private lastComplete = false; private knownDirs = new Set<string>()
  constructor(private c: DavOptions) { this.base = validateEndpoint(c.url, c.allowTestHTTP); if (this.base.search || this.base.hash || /%2f|%5c/i.test(this.base.pathname)) throw Error('WebDAV根地址不能带查询参数或编码分隔符'); if (!this.base.pathname.endsWith('/')) this.base.pathname += '/'; this.namespace = 'webdav:' + digest(this.base.href + '\0' + c.username); this.clock = c.clock ?? { now: () => Date.now() }; this.transport = c.transport ?? fetch }
  private queue<T>(work: () => Promise<T>) { const next = this.tail.then(work); this.tail = next.catch(() => {}); return next }
  private cachePath() { return join(this.c.stateRoot, 'cache/webdav', digest(this.namespace) + '.json') }
  private async loadCache() { if (this.cacheLoaded) return; const raw = await readMaybe(this.cachePath()); if (raw) { try { this.cache = JSON.parse(raw.toString()) as Record<string, RemoteEntry> } catch { this.cache = {} } } this.cacheLoaded = true }
  private path(path: string, allowEmpty = false) { if ((!path && !allowEmpty) || path.startsWith('/') || path.includes('\0') || path.includes('\\') || path.includes('//') || path.split('/').some(p => p === '..' || p === '.')) throw new SyncError('unsupported', '不安全的云端相对路径'); return path }
  private url(path: string) { this.path(path, true); return new URL(this.base.href + path.split('/').map(encodeURIComponent).join('/')) }
  private relative(url: URL) { if (url.origin !== this.base.origin || url.username || url.password || /%2f|%5c/i.test(url.pathname)) throw new SyncError('incomplete', '云端列表链接超出档案范围'); const root = decodeURIComponent(this.base.pathname), decoded = decodeURIComponent(url.pathname); if (!decoded.startsWith(root)) throw new SyncError('incomplete', '云端链接越过档案根目录'); return this.path(decoded.slice(root.length), true) }
  private async request(url: URL, method: string, headers: Record<string, string> = {}, body?: () => RequestOptions['body']) {
    this.relative(url); await this.c.budget.reserve(); this.authorization = 'Basic ' + Buffer.from(this.c.username + ':' + await this.c.getSecret()).toString('base64')
    let stream: ReadStream | undefined
    try {
      const content = body?.(); if (content && typeof content === 'object' && 'destroy' in content) stream = content as unknown as ReadStream
      const response = await this.transport(url.href, { method, headers: { Authorization: this.authorization, ...headers }, body: content, ...(content ? { duplex: 'half' as const } : {}), redirect: 'error', signal: AbortSignal.timeout(this.c.requestTimeoutMs ?? 120000) })
      if (response.status === 401 || response.status === 403) { await response.body?.cancel(); throw new SyncError('unauthorized', '云端认证或权限失效') }
      if (response.status === 429) { const retryAfterMs = await this.c.budget.defer(response.headers.get('retry-after')); await response.body?.cancel(); throw new SyncError('rate_limited', '云端要求稍后重试', retryAfterMs) }
      if (response.status === 507) { await response.body?.cancel(); throw new SyncError('quota', '云端空间或单文件额度不足，内容保留待传') }
      if (response.status >= 500) {const retry=response.headers.get('retry-after'); await response.body?.cancel();const retryAfterMs=retry?await this.c.budget.defer(retry):undefined; throw new SyncError('offline', '云端暂不可用',retryAfterMs) }
      return response
    } catch (e) { if (e instanceof SyncError) throw e; throw new SyncError(['PUT', 'DELETE', 'MKCOL'].includes(method) ? 'outcome_unknown' : 'offline', '网络请求中断，需核对后继续') }
    finally { stream?.destroy() }
  }
  private async text(response: Response) { const chunks: Buffer[] = []; let size = 0; for await (const chunk of responseChunks(response.body)) { size += chunk.byteLength; if (size > 16 * 1024 * 1024) throw new SyncError('incomplete', '云端目录响应超过可验证大小'); chunks.push(Buffer.from(chunk)) } return Buffer.concat(chunks).toString() }
  private async recordId(path: string, hash: string) { if (!path.endsWith('.md')) return undefined; const file = await open(await this.c.objectStore.objectPath(hash), 'r'); try { const buffer = Buffer.alloc(65536), { bytesRead } = await file.read(buffer, 0, buffer.length, 0), prefix = buffer.subarray(0, bytesRead).toString(); const metadata = prefix.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1]; if (!metadata) return undefined; const id = object(parse(metadata)).aia_id; return typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id) ? id : undefined } catch { return undefined } finally { await file.close() } }
  private async download(path: string, revision = '', expectedHash?: string): Promise<RemoteEntry | null> {
    const response = await this.request(this.url(path), 'GET', strong(revision) ? { 'If-Match': revision } : {})
    if (response.status === 404) { await response.body?.cancel(); return null }
    if (response.status === 412) { await response.body?.cancel(); throw new SyncError('conflict', '下载前云端版本已变化') }
    if (!response.ok) { await response.body?.cancel(); throw new SyncError('unsupported', '云端文件读取失败：' + response.status) }
    const etag = response.headers.get('etag') ?? '', result = await this.c.objectStore.ingest(responseChunks(response.body), expectedHash)
    if (strong(revision) && etag !== revision) throw new SyncError('conflict', '下载响应与目录版本不一致')
    const entry: RemoteEntry = { path, hash: result.hash, revision: etag || 'unverified:' + result.hash, size: result.size, writeSafe: strong(etag), recordId: await this.recordId(path, result.hash) }
    this.cache[path] = entry; await atomicWrite(this.cachePath(), JSON.stringify(this.cache)); return entry
  }
  async read(path: string, revision: string) { return this.queue(async () => { this.path(path);if(!strong(revision))throw new SyncError('unsupported','该ETag不能唯一标识不可变文件版本'); await this.loadCache(); const cached = this.cache[path]; if (cached?.revision === revision && await this.c.objectStore.hasObject(cached.hash)) return this.c.objectStore.object(cached.hash); const value = await this.download(path, revision, cached?.revision === revision ? cached.hash : undefined); if (!value) throw new SyncError('not_found', '云端文件已不存在'); if (value.revision !== revision) throw new SyncError('conflict', '云端读取版本已变化'); return this.c.objectStore.object(value.hash) }) }
  private next(header:string|null){if(!header)return null;for(const part of header.split(/,(?=\s*<)/)){const link=part.match(/<([^>]+)>/),rel=part.match(/\brel\s*=\s*(?:"([^"]+)"|([^;,\s]+))/i);if(link&&rel&&(rel[1]??rel[2]).split(/\s+/).includes('next'))return link[1]}return null}
  private async directory(path:string){
    const files:DavMetadata[]=[],dirs:string[]=[],warnings:string[]=[],seenPages=new Set<string>();let current=this.url(path),complete=true,exists=true,sawSelf=false
    while(true){
      if(seenPages.has(current.href)||seenPages.size>=10000){warnings.push('分页链接循环或超出可验证范围');complete=false;break}seenPages.add(current.href)
      const response=await this.request(current,'PROPFIND',{'Depth':'1','Content-Type':'application/xml'},()=>'<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getetag/><d:getcontentlength/></d:prop></d:propfind>')
      if(response.status===404){await response.body?.cancel();exists=false;complete=false;break}
      if(response.status!==207){await response.body?.cancel();warnings.push('目录列举状态未验证：'+response.status);complete=false;break}
      const xml=await this.text(response)
      if(/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true){warnings.push('目录XML不完整或含不支持声明');complete=false;break}
      const parsed=object(new XMLParser({removeNSPrefix:true,parseTagValue:false}).parse(xml)),multi=object(parsed.multistatus)
      if(!('response'in multi)){warnings.push('目录缺少可验证的资源列表');complete=false;break}
      const rows=array(multi.response),next=this.next(response.headers.get('link'))
      if(response.headers.get('x-aia-incomplete')==='true'||(!next&&rows.length>=(this.c.listingLimit??750))){warnings.push('目录达到750条上限且没有已验证下一页');complete=false}
      for(const raw of rows){try{
        const item=object(raw);if(typeof item.href!=='string')throw Error('Missing href')
        const relative=this.relative(new URL(item.href,current)),props:Record<string,unknown>={};let ok=false
        for(const p of array(item.propstat)){const stat=object(p);if(/\s200(?:\s|$)/.test(String(stat.status))){Object.assign(props,object(stat.prop));ok=true}}
        if(!ok)throw Error('Resource properties failed')
        const collection=Object.hasOwn(object(props.resourcetype),'collection')
        if(relative===path){if(collection)sawSelf=true;else{complete=false;warnings.push('根资源未确认为文件夹')}continue}
        if(!relative.startsWith(path)||relative.slice(path.length).replace(/\/$/,'').includes('/'))throw Error('Depth:1 scope mismatch')
        if(collection){dirs.push(relative.endsWith('/')?relative:relative+'/');continue}
        const length=Number(props.getcontentlength);files.push({path:relative,revision:typeof props.getetag==='string'?props.getetag:'',size:Number.isFinite(length)&&length>=0?length:-1})
      }catch{complete=false;warnings.push('目录中存在无法核对的路径或资源')}}
      if(!next)break
      const nextURL=new URL(next,current);if(this.relative(nextURL)!==path){warnings.push('下一页超出当前文件夹范围');complete=false;break}current=nextURL
    }
    if(!sawSelf&&exists){complete=false;warnings.push('未观察到当前文件夹自身，不能确认空目录')}
    return{files,dirs,warnings,complete,exists}
  }
  private async rootValid(){
    const response=await this.request(this.base,'PROPFIND',{'Depth':'0','Content-Type':'application/xml'},()=>'<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>')
    if(response.status!==207){await response.body?.cancel();return false}
    const xml=await this.text(response);if(/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)return false
    const parsed=object(new XMLParser({removeNSPrefix:true,parseTagValue:false}).parse(xml))
    return array(object(parsed.multistatus).response).some(raw=>{const r=object(raw);if(typeof r.href!=='string')return false;try{return this.relative(new URL(r.href,this.base))===''&&array(r.propstat).some(p=>{const s=object(p);return /\s200(?:\s|$)/.test(String(s.status))&&Object.hasOwn(object(object(s.prop).resourcetype),'collection')})}catch{return false}})
  }
  scan():Promise<ScanResult>{return this.queue(async()=>{
    this.lastComplete=false;await this.loadCache();const known=new Set([...Object.keys(this.cache),...await this.c.knownPaths?.()??[]]),queue=[''],visited=new Set<string>(),metadata=new Map<string,DavMetadata>(),warnings:string[]=[];let complete=true,rootExists=true
    this.knownDirs=new Set([''])
    while(queue.length){const directory=queue.shift()!;if(visited.has(directory)){complete=false;warnings.push('文件夹重复或循环');continue}visited.add(directory)
      const result=await this.directory(directory);if(directory==='')rootExists=result.exists;complete&&=result.complete;warnings.push(...result.warnings.map(w=>directory+': '+w))
      for(const d of result.dirs){if(this.knownDirs.has(d)){complete=false;warnings.push('文件夹重复：'+d)}else{this.knownDirs.add(d);queue.push(d)}}
      for(const file of result.files){if(metadata.has(file.path)){complete=false;warnings.push('分页包含重复文件：'+file.path)}else metadata.set(file.path,file)}
    }
    const absent:string[]=[]
    if(complete)for(const path of known){
      if(metadata.has(path))continue
      if(this.knownDirs.has(path+'/')){complete=false;warnings.push('旧文件路径变为文件夹，请核对：'+path);continue}
      const head=await this.request(this.url(path),'HEAD')
      if(head.status===404){await head.body?.cancel();absent.push(path);continue}
      if(head.ok){const length=head.headers.get('content-length'),revision=head.headers.get('etag')??'';await head.body?.cancel();metadata.set(path,{path,revision,size:length===null?-1:Number(length)});warnings.push('分页遗漏的旧路径已重新核实：'+path);continue}
      await head.body?.cancel();const current=await this.download(path)
      if(!current)absent.push(path);else metadata.set(path,{path,revision:current.revision,size:current.size})
    }
    if(absent.length){if(!await this.rootValid()){rootExists=false;complete=false;warnings.push('档案根目录无法确认，未传播删除')}else{for(const path of absent)delete this.cache[path];await atomicWrite(this.cachePath(),JSON.stringify(this.cache))}}
    const entries:RemoteEntry[]=[]
    for(const meta of metadata.values()){
      const cached=this.cache[meta.path]
      if(strong(meta.revision)&&cached?.revision===meta.revision&&cached.writeSafe&&(meta.size<0||meta.size===cached.size)&&await this.c.objectStore.hasObject(cached.hash)){entries.push(cached);continue}
      if(!complete)continue
      try{const item=await this.download(meta.path,meta.revision,strong(meta.revision)&&cached?.revision===meta.revision?cached.hash:undefined);if(!item){complete=false;warnings.push('列举后文件消失：'+meta.path);continue}if(meta.size>=0&&meta.size!==item.size){complete=false;warnings.push('列举与下载大小不一致：'+meta.path);delete this.cache[meta.path];await atomicWrite(this.cachePath(),JSON.stringify(this.cache));continue}if(!item.writeSafe)warnings.push('文件缺少强ETag，条件写入受限：'+meta.path);entries.push(item)}
      catch(e){if(e instanceof SyncError&&['unauthorized','rate_limited','quota','offline'].includes(e.code))throw e;complete=false;warnings.push('文件版本无法完整核对：'+meta.path)}
    }
    entries.sort((a,b)=>a.path.localeCompare(b.path));this.lastComplete=complete&&rootExists
    return{complete:this.lastComplete,rootExists,entries,revision:digest(JSON.stringify(entries.map(e=>[e.path,e.hash,e.revision]))),warnings}
  })}
  private async parents(path:string){const parts=path.split('/');parts.pop();let parent='';for(const part of parts){parent+=part+'/';if(this.knownDirs.has(parent))continue;const r=await this.request(this.url(parent),'MKCOL',{'If-None-Match':'*'});await r.body?.cancel();if(![201,405,412].includes(r.status))throw new SyncError('not_found','云端父目录不可用，未重建档案根目录');this.knownDirs.add(parent)}}
  private async verify(change:RemoteChange):Promise<EndpointReceipt['items'][number]>{
    const current=await this.download(change.path)
    if(change.kind==='delete'&&!current){if(!await this.rootValid()){this.lastComplete=false;throw new SyncError('incomplete','档案根目录失效，不能确认单文件删除')}delete this.cache[change.path];await atomicWrite(this.cachePath(),JSON.stringify(this.cache));return{operationId:change.operationId,path:change.path,status:'confirmed',hash:null,revision:null}}
    if(current&&current.hash===change.objectHash){if(!current.writeSafe)throw new SyncError('unsupported','读回缺少强ETag，未宣告可安全同步');return{operationId:change.operationId,path:change.path,status:'confirmed',hash:current.hash,revision:current.revision}}
    return{operationId:change.operationId,path:change.path,status:'conflict',error:'云端读回与待提交内容不同，保留双方版本'}
  }
  apply(batch:ChangeBatch):Promise<EndpointReceipt>{return this.queue(async()=>{
    if(batch.endpointId!==this.id||batch.namespace!==this.namespace)throw Error('Wrong endpoint namespace')
    if(!this.lastComplete)throw new SyncError('incomplete','没有完整有效扫描，未进行发布')
    const caps=this.c.capabilities;if(!caps.authenticated||!caps.conditionalWrite||!caps.conditionalDelete||!caps.createOnly||!caps.unicodePaths||!caps.completeListing)throw new SyncError('unsupported','尚未验证可靠条件写入，禁止覆盖式降级')
    const result:EndpointReceipt={batchId:batch.id,endpointId:this.id,namespace:this.namespace,verifiedAt:new Date(this.clock.now()).toISOString(),complete:true,items:[]}
    let stopped:SyncError|undefined
    for(const change of batch.changes){let accepted=false
      if(stopped){result.items.push({operationId:change.operationId,path:change.path,status:'failed',error:'未尝试：'+stopped.message});continue}
      try{
        this.path(change.path);if(change.path.endsWith('/')||this.knownDirs.has(change.path+'/'))throw new SyncError('unsupported','仅允许对档案文件进行条件操作')
        if(change.expected.type==='present'&&(!strong(change.expected.revision)||this.cache[change.path]?.writeSafe===false))throw new SyncError('unsupported','文件缺少可用于条件操作的强ETag')
        const headers:Record<string,string>=change.expected.type==='absent'?{'If-None-Match':'*'}:{'If-Match':change.expected.revision}
        let body:(()=>RequestOptions['body'])|undefined
        if(change.kind==='put'){
          if(!change.objectHash)throw Error('Missing upload object');const file=await this.c.objectStore.objectPath(change.objectHash),size=(await stat(file)).size
          headers['Content-Length']=String(size);headers['Content-Type']='application/octet-stream';await this.parents(change.path)
          // Node fetch accepts a Readable body with duplex:half; keep bytes on disk.
          body=()=>createReadStream(file) as unknown as BodyInit
        }
        try{const response=await this.request(this.url(change.path),change.kind==='put'?'PUT':'DELETE',headers,body);accepted=response.ok;await response.body?.cancel();if(!response.ok&&response.status!==412&&!(change.kind==='delete'&&response.status===404))throw new SyncError(response.status===404||response.status===409?'not_found':'unsupported','云端写入未接受：'+response.status)}
        catch(e){if(!(e instanceof SyncError)||e.code!=='outcome_unknown')throw e;accepted=true}
        result.items.push(await this.verify(change))
      }catch(e){const error=e instanceof SyncError?e:new SyncError('offline','本机或云端操作未完成');result.items.push({operationId:change.operationId,path:change.path,status:accepted?'outcome_unknown':error.code==='conflict'?'conflict':'failed',error:error.message});result.error={code:error.code,message:error.message,retryAfterMs:error.retryAfterMs};if(['unauthorized','rate_limited','quota','offline','incomplete'].includes(error.code))stopped=error}
    }
    result.complete=result.items.every(i=>i.status==='confirmed');return result
  })}
}
