import type { RecordEnvelope } from './schemas'
import type { SaveRecord,RecordFilter,DeletionReceipt,AttachmentRef,ArchiveChange } from './models'
import type { SearchQuery,SearchPage,IndexReport } from './search'
import type { CapturePreview,CaptureReceipt } from './capture'
import type { ScheduleInput,PlanStatus } from './plans'
import type { GarminOverview,GarminActivity,GarminWorkout } from './garmin'
import type { HomeOverview,AdvicePreview,AdoptAdvice } from './reports'
import type { ConfigureConnection,ConnectionState,EndpointId } from './connections'
export interface RuntimeInfo {archiveRoot:string;stateRoot:string;sqliteReady:boolean;now:string}
export interface RecordView {record:RecordEnvelope;path:string;hash:string}
export interface AiaAPI {
 runtime():Promise<RuntimeInfo>
 records:{list(filter?:RecordFilter):Promise<RecordView[]>;get(id:string):Promise<RecordView|null>;save(input:SaveRecord):Promise<RecordEnvelope>;remove(id:string,hash:string):Promise<DeletionReceipt>;restore(id:string):Promise<RecordEnvelope|null>}
 drafts:{get(key:string):Promise<string>;save(key:string,text:string):Promise<void>}
 attachments:{choose():Promise<AttachmentRef[]>;resolve(id:string):Promise<AttachmentRef|null>;open(id:string):Promise<void>}
 capture:{preview(text:string,attachmentIds:string[]):Promise<CapturePreview>;commit(preview:CapturePreview):Promise<CaptureReceipt>;undo(sourceId:string):Promise<void>}
 plans:{schedule(input:ScheduleInput):Promise<RecordEnvelope>;listDay(date:string):Promise<RecordEnvelope[]>;setStatus(id:string,status:PlanStatus,hash:string):Promise<RecordEnvelope>;reschedule(id:string,date:string,hash:string):Promise<RecordEnvelope>}
 learning:{listSubjects():Promise<RecordEnvelope[]>;getSubject(id:string):Promise<{subject:RecordEnvelope;notes:RecordEnvelope[]}|null>;saveSubject(input:SaveRecord):Promise<RecordEnvelope>;saveNote(input:SaveRecord):Promise<RecordEnvelope>}
 research:{listProjects():Promise<RecordEnvelope[]>;getProject(id:string):Promise<{project:RecordEnvelope;experiments:RecordEnvelope[]}|null>;saveProject(input:SaveRecord):Promise<RecordEnvelope>;saveExperiment(input:SaveRecord):Promise<RecordEnvelope>}
 diet:{listDay(date:string):Promise<RecordEnvelope[]>;saveMeal(input:SaveRecord):Promise<RecordEnvelope>}
 games:{saveGame(input:SaveRecord):Promise<RecordEnvelope>;saveSession(input:SaveRecord):Promise<RecordEnvelope>;listSessions(gameId:string):Promise<RecordEnvelope[]>}
 development:{saveProject(input:SaveRecord):Promise<RecordEnvelope>;saveIssue(input:SaveRecord):Promise<RecordEnvelope>;saveVersion(input:SaveRecord):Promise<RecordEnvelope>;openRepo(projectId:string):Promise<void>}
 garmin:{overview(date:string):Promise<GarminOverview>;activities(range?:{from?:string;through?:string}):Promise<GarminActivity[]>;trainingPlan(date:string):Promise<GarminWorkout[]>}
 reports:{overview(date:string):Promise<HomeOverview>;buildWeekly(date:string):Promise<RecordEnvelope>;training(date:string):Promise<AdvicePreview[]>;adopt(input:AdoptAdvice):Promise<{adviceId:string;planId:string|null}>}
 connections:{getState():Promise<ConnectionState>;configure(input:ConfigureConnection):Promise<ConnectionState>;setEnabled(id:EndpointId,enabled:boolean):Promise<ConnectionState>;test(id:EndpointId):Promise<ConnectionState>;export():Promise<ConnectionState>;exportFile():Promise<boolean>;onChange(listener:()=>void):()=>void}
 search:{query(input:SearchQuery):Promise<SearchPage>;rebuild():Promise<IndexReport>}
 sources:{resolve(id:string):Promise<{path:string;exists:boolean;changed:boolean;hash:string|null}>;open(id:string):Promise<void>;recordForPath(path:string):Promise<string|null>}
 onChange(listener:(change:ArchiveChange)=>void):()=>void
}
declare global {interface Window {aia:AiaAPI}}
