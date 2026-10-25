import type Database from 'better-sqlite3'
import type { LegacyImporter } from '../archive/importer'
import type { RecordView } from '../../shared/api'
import type { RecordFilter } from '../../shared/models'
import type { SearchQuery,SearchPage,IndexReport } from '../../shared/search'
import { initializeIndex } from './database'
import { updateProjection } from './projection'
import { queryParts } from './query'
import { readMaybe } from '../archive/transactions'
import { safePath } from '../archive/paths'
import { hashBytes } from '../archive/codec'
interface Row {id:string;path:string;hash:string;title:string;body:string;module:SearchPage['items'][number]['module'];kind:SearchPage['items'][number]['kind'];date:string;search_text:string;json:string}
export class SearchService{
 private generation=1;private indexed=0;private work:Promise<void>|null=null;private report:IndexReport={documents:0,complete:false,issues:[]}
 constructor(readonly db:Database.Database,readonly importer:LegacyImporter){initializeIndex(db)}
 invalidate(){this.generation++}
 private async ensure(){while(this.indexed<this.generation){if(this.work){await this.work;continue}const g=this.generation;this.work=(async()=>{const report=await this.importer.scan();updateProjection(this.db,report);this.report={documents:report.views.length,complete:report.complete,issues:report.issues};this.indexed=g})().finally(()=>{this.work=null});await this.work}}
 async rebuild(){this.db.exec('DELETE FROM documents');this.invalidate();await this.ensure();return this.report}
 async status(){await this.ensure();return this.report}
 async list(filter:RecordFilter={}){await this.ensure();const clauses:string[]=[],params:string[]=[];for(const k of ['module','kind','date','role'] as const)if(filter[k]){clauses.push(k+'=?');params.push(filter[k]!)}return(this.db.prepare('SELECT json FROM documents '+(clauses.length?'WHERE '+clauses.join(' AND '):'')+' ORDER BY updated_at DESC,id').all(...params) as {json:string}[]).map(r=>JSON.parse(r.json)as RecordView)}
 async view(id:string){await this.ensure();const row=this.db.prepare('SELECT json FROM documents WHERE id=?').get(id) as {json:string}|undefined;return row?JSON.parse(row.json) as RecordView:null}
 async query(input:SearchQuery):Promise<SearchPage>{await this.ensure();const p=queryParts(input),total=(this.db.prepare('SELECT count(*) AS total FROM documents '+p.where).get(...p.params) as {total:number}).total;const rows=this.db.prepare('SELECT * FROM documents '+p.where+' ORDER BY updated_at DESC,id LIMIT ? OFFSET ?').all(...p.params,p.limit,p.offset) as Row[];return{items:rows.map(r=>{const at=Math.max(0,r.search_text.toLocaleLowerCase().indexOf(p.query.toLocaleLowerCase()));return{recordId:r.id,path:r.path,hash:r.hash,title:r.title,module:r.module,kind:r.kind,date:r.date,query:p.query,excerpt:r.search_text.slice(Math.max(0,at-28),at+Math.max(80,p.query.length))}}),total,hasMore:p.offset+rows.length<total}}
 async resolveSource(id:string){const view=await this.view(id);if(!view)throw Error('Source is no longer indexed');const path=await safePath(this.importer.root,view.path),bytes=await readMaybe(path);return {path,exists:!!bytes,changed:!!bytes&&hashBytes(bytes)!==view.hash,hash:bytes?hashBytes(bytes):null}}
}
