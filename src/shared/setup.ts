import type { BackupReceipt } from './backup'
export interface LegacyEvidence{detected:boolean;ready:boolean;detail:string}
export interface SourcePreview{id:string;sourceRoot:string;archiveId:string;fingerprint:string;files:{path:string;hash:string;size:number}[];excluded:{path:string;reason:string}[];hasCatalog:boolean;legacy:LegacyEvidence;backup?:BackupReceipt}
