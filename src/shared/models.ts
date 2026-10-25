export const MODULES=['learning','research','sports','diet','games','development','inbox'] as const
export const KINDS=['raw_input','subject','note','research_project','experiment','activity','meal','game','play_session','dev_project','dev_issue','dev_version','plan','report','advice','document'] as const
export type ModuleId=typeof MODULES[number]
export type RecordKind=typeof KINDS[number]
export type { RecordEnvelope } from './schemas'
export type RecordRole='actual'|'plan'|'reference'|'template'|'analysis'|'suggestion'
export interface SourceRef {archiveId?:string;path?:string;recordId?:string;heading?:string;hash?:string;start?:number;end?:number;capturedAt?:string}
export interface RecordFilter {module?:ModuleId;kind?:RecordKind;date?:string;role?:RecordRole}
export interface ArchiveInfo {archiveId:string;root:string;schemaVersion:number}
export interface ArchiveChange {transactionId:string;ids:string[];paths:string[];origin:'app'|'external'|'sync'|'restore'}
export interface SaveRecord {record:import('./schemas').RecordEnvelope;expectedHash:string|null}
export interface DeletionReceipt {id:string;transactionId:string;priorHash:string}
export interface RecoveryReport {recovered:string[];conflicts:string[]}
export interface AttachmentRef {id:string;path:string;hash:string;name:string;size:number}
export type Unsubscribe=()=>void
