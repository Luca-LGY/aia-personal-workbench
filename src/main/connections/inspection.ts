import { ArchivePolicy } from '../archive/policy'
import type { EndpointAdapter,EndpointId } from '../../shared/sync'
import type { CloudInspection } from '../../shared/connections'
import type { ConnectionService } from './settings'
import type { SyncObjectStore } from '../sync/streams'
import { WebdavAdapter } from '../sync/adapters/webdav'
import { GithubAdapter } from '../sync/adapters/github'
import { RequestBudget } from '../sync/request-budget'
import { SyncError } from '../sync/errors'
export class CloudService {
  private adapters=new Map<EndpointId,{revision:number;adapter:EndpointAdapter}>()
  constructor(private connections:ConnectionService,private objects:SyncObjectStore,private stateRoot:string,private initializationError?:string,private knownPaths?:(namespace:string)=>Promise<string[]>,private knownHead?:(namespace:string)=>Promise<string|undefined>,private archiveRoot?:string ){}
  async adapter(id:EndpointId):Promise<EndpointAdapter|null>{
    if(this.initializationError)throw Error('同步历史无法安全读取，请先从备份恢复；本机记录仍可使用。')
    const client=await this.connections.client(id);if(!client){this.adapters.delete(id);return null}
    if((await this.connections.getState()).endpoints[id].status!=='verified')throw new SyncError('unsupported','请先验证该云端连接')
    const existing=this.adapters.get(id);if(existing?.revision===client.revision)return existing.adapter
    const includePath=async(path:string)=>!(this.archiveRoot?await ArchivePolicy.open(this.archiveRoot):new ArchivePolicy()).excluded(path)
    let adapter:EndpointAdapter
    const secret=async()=>{const latest=await this.connections.client(id);if(!latest||latest.revision!==client.revision)throw new SyncError('conflict','连接已更改或停用，停止旧请求');return latest.secret}
    if(client.id==='github')adapter=new GithubAdapter({includePath,owner:client.owner,repo:client.repo,branch:client.branch,apiBase:client.apiBase,allowTestHTTP:client.allowTestHTTP,getSecret:secret,stateRoot:this.stateRoot,objectStore:this.objects,budget:new RequestBudget(this.stateRoot,'github:'+client.owner,{maxRequests:4000,windowMs:3600000}),knownHead:()=>this.knownHead?.(adapter.namespace)??Promise.resolve(undefined)})
    else adapter=new WebdavAdapter({includePath,url:client.url,username:client.username,getSecret:secret,allowTestHTTP:client.allowTestHTTP,stateRoot:this.stateRoot,objectStore:this.objects,budget:new RequestBudget(this.stateRoot,new URL(client.url).origin+'\0'+client.username),capabilities:client.capabilities!,knownPaths:()=>this.knownPaths?.(adapter.namespace)??Promise.resolve([])})
    this.adapters.set(id,{revision:client.revision,adapter});return adapter
  }
  async inspect(id:EndpointId):Promise<CloudInspection>{const adapter=await this.adapter(id);if(!adapter)throw Error('请先配置并启用该连接');const scan=await adapter.scan();return{id,complete:scan.complete,rootExists:scan.rootExists,fileCount:scan.entries.length,revision:scan.revision,warnings:scan.warnings??[],readAt:new Date().toISOString()}}
}
