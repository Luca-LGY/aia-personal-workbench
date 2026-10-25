import { readFile,stat,mkdir } from 'node:fs/promises'
import { join,basename,extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { parseDocument,hashBytes } from './codec'
import { ensureRoot,walkFiles } from './paths'
import { atomicWrite,readMaybe } from './transactions'
import { stableDocumentId,type IdentityMap } from './identity-map'
import { makeRecord,localDate } from '../../shared/schemas'
import type { RecordView } from '../../shared/api'
import type { ModuleId } from '../../shared/models'
export interface ImportIssue {code:string;path:string;message:string}
export interface ImportReport {complete:boolean;views:RecordView[];issues:ImportIssue[];files:number}
export function moduleForPath(path:string):ModuleId{if(path.startsWith('每日记录/学习数据'))return'learning';if(path.startsWith('每日记录/科研实验'))return'research';if(path.startsWith('运动/'))return'sports';if(/^(饮食|饮食记录)/.test(path))return'diet';if(/^(游戏|娱乐)/.test(path))return'games';if(path.startsWith('开发工作/'))return'development';return'inbox'}
export class LegacyImporter{
 constructor(readonly root:string,readonly stateRoot:string,readonly readOnly=false){}
 async scan():Promise<ImportReport>{
  const views:RecordView[]=[],issues:ImportIssue[]=[];let complete=true
  await ensureRoot(this.root)
  const catPath=join(this.root,'.aia','catalog.json'),cat=await readMaybe(catPath),archiveId=cat?(JSON.parse(cat.toString())as{archiveId:string}).archiveId:this.readOnly?stableDocumentId('preview',this.root):randomUUID()
  if(!cat&&!this.readOnly)await atomicWrite(catPath,JSON.stringify({archiveId,schemaVersion:1}))
  const mapPath=join(this.root,'.aia','identities','files.json'),oldBytes=await readMaybe(mapPath),old:IdentityMap=oldBytes?JSON.parse(oldBytes.toString()):{}
  let paths:string[];try{paths=await walkFiles(this.root)}catch(e){return{complete:false,views:[],issues:[{code:'scan-error',path:'',message:String(e)}],files:0}}
  const pathSet=new Set(paths),next:IdentityMap=Object.fromEntries(Object.entries(old).map(([p,v])=>[p,{...v,present:false}]))
  const items=[]
  for(const path of paths){try{const bytes=await readFile(join(this.root,path)),metadata=await stat(join(this.root,path)),p=path.endsWith('.md')?parseDocument(bytes,path):null;items.push({path,bytes,metadata,p,hash:hashBytes(bytes)})}catch(e){complete=false;issues.push({code:'read-error',path,message:String(e)})}}
  const ids=new Map<string,number>();for(const x of items)if(x.p?.status==='record')ids.set(x.p.record.id,(ids.get(x.p.record.id)??0)+1)
  for(const x of items){
   const typed=x.p?.status==='record'?x.p.record:null,duplicate=typed&&(ids.get(typed.id)??0)>1
   if(duplicate)issues.push({code:'duplicate-id',path:x.path,message:'Duplicate ID; original preserved'})
   if(x.p?.status==='invalid')issues.push({code:'invalid-metadata',path:x.path,message:x.p.issues.join('; ')})
   if(!typed&&old[x.path]?.wasTyped)issues.push({code:'missing-id',path:x.path,message:'Stable ID removed externally; do not overwrite original'})
   const moves=Object.entries(old).filter(([p,v])=>!pathSet.has(p)&&v.hash===x.hash)
   const id=typed&&!duplicate?typed.id:old[x.path]?.id??(moves.length===1?moves[0][1].id:stableDocumentId(archiveId,x.path))
   const virtualId=duplicate?stableDocumentId(archiveId,x.path):id
   next[x.path]={id:virtualId,hash:x.hash,wasTyped:!!typed,present:true}
   let record=typed&&!duplicate?typed:null
   if(!record){const textual=/\.(md|txt|json|csv|yaml|yml)$/i.test(x.path);const body=textual?x.bytes.toString('utf8'):'';const title=body.match(/^#\s+(.+)$/m)?.[1]??basename(x.path);record=makeRecord('document',{id:virtualId,module:moduleForPath(x.path),role:/模板|template|README/i.test(x.path)?'template':'reference',title,date:localDate(x.metadata.mtime),createdAt:x.metadata.birthtime.toISOString(),updatedAt:x.metadata.mtime.toISOString(),body,sourceRefs:[{archiveId,path:x.path,hash:x.hash}],data:{legacy:true,fileType:extname(x.path),originalRecordId:typed?.id,issue:duplicate||x.p?.status==='invalid'||old[x.path]?.wasTyped&&!typed?'需要核对来源元数据':undefined}})}
   views.push({record,path:x.path,hash:x.hash})
  }
  if(!this.readOnly){await mkdir(join(this.root,'.aia','identities'),{recursive:true});const bytes=Buffer.from(JSON.stringify(next));if(!oldBytes||!bytes.equals(oldBytes))await atomicWrite(mapPath,bytes)}
  return {complete,views,issues,files:paths.length}
 }
}
