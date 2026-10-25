import type { RecordEnvelope } from './schemas'
import type { SaveRecord,RecordFilter,DeletionReceipt,AttachmentRef,ArchiveChange } from './models'
export interface RuntimeInfo {archiveRoot:string;stateRoot:string;sqliteReady:boolean}
export interface RecordView {record:RecordEnvelope;path:string;hash:string}
export interface AiaAPI {
 runtime():Promise<RuntimeInfo>
 records:{list(filter?:RecordFilter):Promise<RecordView[]>;get(id:string):Promise<RecordView|null>;save(input:SaveRecord):Promise<RecordEnvelope>;remove(id:string,hash:string):Promise<DeletionReceipt>;restore(id:string):Promise<RecordEnvelope|null>}
 drafts:{get(key:string):Promise<string>;save(key:string,text:string):Promise<void>}
 attachments:{choose():Promise<AttachmentRef[]>}
 onChange(listener:(change:ArchiveChange)=>void):()=>void
}
declare global {interface Window {aia:AiaAPI}}
