import { ArchiveRepository } from './archive/repository'
import { AttachmentStore,DraftStore } from './archive/attachments'
export async function createServices(archiveRoot:string,stateRoot:string){
 const repository=new ArchiveRepository(archiveRoot,stateRoot);await repository.open()
 return {repository,attachments:new AttachmentStore(archiveRoot,stateRoot),drafts:new DraftStore(stateRoot)}
}
export type Services=Awaited<ReturnType<typeof createServices>>
