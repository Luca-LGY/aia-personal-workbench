import { loadEndpointBindings } from './connections/bindings'
import { ArchiveRepository } from './archive/repository'
import { AttachmentStore,DraftStore } from './archive/attachments'
import { LegacyImporter } from './archive/importer'
import { watchArchive } from './archive/watcher'
import type Database from 'better-sqlite3'
import { SearchService } from './indexing/search'
import { CaptureService } from './capture/service'
import { PlanService } from './plans/service'
import { LearningService } from './modules/learning'
import { ResearchService } from './modules/research'
import { DietService } from './modules/diet'
import { GamesService } from './modules/games'
import { DevelopmentService } from './modules/development'
import { GarminArchiveReader } from './garmin/reader'
import { WeeklyReportService } from './reports/weekly'
import { TrainingAdviceService } from './reports/training'
import { OverviewService } from './reports/overview'
import { safeStorage } from 'electron'
import { CredentialVault } from './connections/credential-vault'
import { ConnectionService } from './connections/settings'
import { SyncJournal } from './sync/journal'
import { CloudService } from './connections/inspection'
import { SyncCoordinator } from './sync/coordinator'
import { SyncScheduler } from './sync/scheduler'
import { OperationGate } from './operation-gate'
import { BackupService } from './backup/exporter'
import { WorkspaceService } from './workspace'
import { MigrationService } from './sync/migration'
import { ArchiveSetupService } from './sync/archive-setup'
export async function createServices(archiveRoot:string,stateRoot:string,db:Database.Database,now:()=>Date=()=>new Date(),allowTestHTTP=false,workspaceRoot=stateRoot){
 const gate=new OperationGate()
 const repository=new ArchiveRepository(archiveRoot,stateRoot);await repository.open()
 const pendingPaths=new Set<string>();let indexingReady=false
 const stopWatcher=await watchArchive(archiveRoot,paths=>{if(!indexingReady){for(const path of paths)pendingPaths.add(path);return}gate.run(()=>repository.notifyExternal(paths)).catch(e=>console.error('Archive change could not be indexed:',e instanceof Error?e.message:String(e)))})
 const importer=new LegacyImporter(archiveRoot,stateRoot),initial=await importer.scan()
 const search=new SearchService(db,importer,initial);repository.onChange(()=>search.invalidate());indexingReady=true
 if(pendingPaths.size)await repository.notifyExternal([...pendingPaths])
 const garmin=new GarminArchiveReader(archiveRoot,now),weekly=new WeeklyReportService(repository,garmin,search,now),training=new TrainingAdviceService(repository,garmin),overview=new OverviewService(weekly,search,garmin)
 const connections=new ConnectionService(stateRoot,new CredentialVault(stateRoot,safeStorage),allowTestHTTP);await connections.open()
 const syncJournal=new SyncJournal(stateRoot,repository.info.archiveId);let syncInitializationError:string|undefined
 try{await syncJournal.open()}catch{syncInitializationError='同步历史无法安全读取'}
 const cloud=new CloudService(connections,syncJournal,stateRoot,syncInitializationError,async namespace=>{const state=syncJournal.getState();return Object.entries(state.baselines[namespace]?.entries??{}).filter(([,v])=>state.graph[v.nodeId]?.state.kind==='present').map(([path])=>path)},async namespace=>syncJournal.getState().baselines[namespace]?.remoteRevision,archiveRoot)
 const bindings=()=>loadEndpointBindings(connections,cloud)
 const coordinator=new SyncCoordinator(repository,syncJournal,bindings,{ready:allowTestHTTP&&process.env.AIA_TEST_SYNC_READY==='1',settleLocal:()=>search.list()});await coordinator.open()
 const scheduler=new SyncScheduler(reason=>gate.run(()=>coordinator.run(reason)));repository.onChange(()=>scheduler.localChange());connections.onChange(()=>{coordinator.markDirty();scheduler.localChange()})

 const backup=new BackupService(repository,coordinator,gate,{publicSettings:()=>connections.export()}),workspace=new WorkspaceService(workspaceRoot)
 const migration=new MigrationService(repository,coordinator,bindings),setup=new ArchiveSetupService(repository,coordinator,migration,workspace,{baseRoot:workspaceRoot})
 return {gate,backup,workspace,migration,setup,repository,importer,search,stopWatcher,connections,cloud,syncJournal,coordinator,scheduler,syncInitializationError,garmin,weekly,training,overview,development:new DevelopmentService(repository),games:new GamesService(repository),diet:new DietService(repository),research:new ResearchService(repository),learning:new LearningService(repository),plans:new PlanService(repository,async id=>(await search.view(id))?.record??null),capture:new CaptureService(repository,now),attachments:new AttachmentStore(archiveRoot,stateRoot),drafts:new DraftStore(stateRoot)}
}
export type Services=Awaited<ReturnType<typeof createServices>>
