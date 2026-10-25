export interface WebdavConfig {url:string;username:string;secret:string;allowTestHTTP?:boolean}
export interface CapabilityReport {authenticated:boolean;conditionalWrite:boolean;conditionalDelete:boolean;createOnly:boolean;unicodePaths:boolean;completeListing:boolean;verifiedAt:string;issues:string[]}
export interface GithubConfig {owner:string;repo:string;branch:string;token:string;apiBase?:string}
export type EndpointId='webdav'|'github'
export type PublicConnectionConfig={id:'webdav';url:string;username:string}|{id:'github';owner:string;repo:string;branch:string}
export type ConfigureConnection=PublicConnectionConfig&{secret?:string}
export interface EndpointState {id:EndpointId;enabled:boolean;config:PublicConnectionConfig|null;credentialStored:boolean;status:'not_configured'|'configured'|'verified'|'error'|'disabled';verifiedAt:string|null;capabilities?:CapabilityReport;github?:{private:boolean;writable:boolean;head:string};error?:string;revision:number}
export interface ConnectionState {schemaVersion:1;endpoints:Record<EndpointId,EndpointState>}
export interface CloudInspection {id:EndpointId;complete:boolean;rootExists:boolean;fileCount:number;revision:string;warnings:string[];readAt:string}
