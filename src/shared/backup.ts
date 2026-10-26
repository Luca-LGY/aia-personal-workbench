export interface BackupEntry{path:string;size:number;hash:string}
export interface BackupManifest{schemaVersion:1;appVersion:string;archiveId:string;createdAt:string;entries:BackupEntry[];records:{id:string;path:string}[];attachments:{id:string;path:string}[];excluded:string[];notes:string[]}
export interface BackupPreview extends BackupManifest{file:string;fingerprint:string;totalBytes:number}
export interface BackupReceipt{file:string;createdAt:string;files:number;bytes:number;hash:string}
export interface RestoreReceipt{archiveRoot:string;stateRoot:string;target:string;files:number;publishSuspended:true}
