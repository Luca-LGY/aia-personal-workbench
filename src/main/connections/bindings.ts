import type { ConnectionService } from './settings'
import type { CloudService } from './inspection'
import type { EndpointBinding } from '../sync/coordinator'
import type { EndpointAdapter } from '../../shared/sync'
import { digest } from '../sync/graph'
import { SyncError } from '../sync/errors'
export async function loadEndpointBindings(connections:ConnectionService,cloud:CloudService):Promise<EndpointBinding[]>{const state=await connections.getState(),bindings:EndpointBinding[]=[];for(const id of ['webdav','github']as const){const e=state.endpoints[id];if(!e.enabled||!e.config)continue;let adapter:EndpointAdapter|null=null;try{if(e.status==='verified')adapter=await cloud.adapter(id)}catch{/* keep the enabled endpoint visible and stop its authentication requests */}if(!adapter){const fail=async()=>{throw new SyncError(e.status==='configured'?'unsupported':'unauthorized','请先重新保存并验证此连接')};adapter={id,namespace:'unverified:'+id+':'+digest(JSON.stringify(e.config)),scan:fail,read:fail,apply:fail}}bindings.push({adapter,configRevision:e.revision,initializeEmpty:e.status==='verified'})}return bindings}
