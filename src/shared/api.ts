import type { RecordEnvelope } from './schemas'
import type { SaveRecord,RecordFilter,DeletionReceipt,AttachmentRef,ArchiveChange } from './models'
import type { SearchQuery,SearchPage,IndexReport } from './search'
import type { CapturePreview,CaptureReceipt } from './capture'
import type { ScheduleInput,PlanStatus } from './plans'
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
 search:{query(input:SearchQuery):Promise<SearchPage>;rebuild():Promise<IndexReport>}
 sources:{resolve(id:string):Promise<{path:string;exists:boolean;changed:boolean;hash:string|null}>;open(id:string):Promise<void>}
 onChange(listener:(change:ArchiveChange)=>void):()=>void
}
declare global {interface Window {aia:AiaAPI}}
