import type { ModuleId,RecordKind } from './models'
export interface SearchQuery {query:string;module?:ModuleId;kind?:RecordKind;dateFrom?:string;dateTo?:string;limit?:number;offset?:number}
export interface SearchHit {recordId:string;path:string;hash:string;title:string;module:ModuleId;kind:RecordKind;date:string;excerpt:string;query:string}
export interface SearchPage {items:SearchHit[];total:number;hasMore:boolean}
export interface IndexReport {documents:number;complete:boolean;issues:{code:string;path:string;message:string}[]}
