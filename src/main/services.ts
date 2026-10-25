import { ArchiveRepository } from './archive/repository'
import { AttachmentStore,DraftStore } from './archive/attachments'
import { LegacyImporter } from './archive/importer'
import { watchArchive } from './archive/watcher'
import type Database from 'better-sqlite3'
import { SearchService } from './indexing/search'
import { CaptureService } from './capture/service'
import { PlanService } from './plans/service'
import { LearningService } from './modules/learning'
export async function createServices(archiveRoot:string,stateRoot:string,db:Database.Database,now:()=>Date=()=>new Date()){
 const repository=new ArchiveRepository(archiveRoot,stateRoot);await repository.open()
 const importer=new LegacyImporter(archiveRoot,stateRoot);await importer.scan()
 const search=new SearchService(db,importer);repository.onChange(()=>search.invalidate())
 const stopWatcher=await watchArchive(archiveRoot,paths=>{repository.notifyExternal(paths).catch(e=>console.error('Archive change could not be indexed:',e instanceof Error?e.message:String(e)))})
 return {repository,importer,search,stopWatcher,learning:new LearningService(repository),plans:new PlanService(repository,async id=>(await search.view(id))?.record??null),capture:new CaptureService(repository,now),attachments:new AttachmentStore(archiveRoot,stateRoot),drafts:new DraftStore(stateRoot)}
}
export type Services=Awaited<ReturnType<typeof createServices>>
