import { createHash } from 'node:crypto'
export interface IdentityEntry {id:string;hash:string;wasTyped:boolean;present:boolean}
export type IdentityMap=Record<string,IdentityEntry>
export function stableDocumentId(archiveId:string,path:string){const h=createHash('sha256').update(archiveId+'\0'+path.normalize('NFC')).digest('hex');return`${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`}
