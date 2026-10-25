export interface RuntimeInfo {archiveRoot:string;stateRoot:string;sqliteReady:boolean}
export interface AiaAPI {runtime():Promise<RuntimeInfo>}
declare global {interface Window {aia:AiaAPI}}
