import type { EndpointId } from './connections'
export type { EndpointId } from './connections'
export interface RemoteEntry { path: string; hash: string; revision: string; size: number; recordId?: string; restored?: boolean;writeSafe?:boolean }
export interface ScanResult { complete: boolean; rootExists: boolean; revision: string; entries: RemoteEntry[]; warnings?: string[];historyRewritten?:boolean }
export type VersionState = { kind: 'present'; hash: string } | { kind: 'deleted'; priorHash: string | null }
export interface VersionNode { id: string; path: string; parents: string[]; state: VersionState; origin: string; operation: 'put' | 'delete' | 'merge' | 'restore'; recordId?: string }
export interface EndpointBaseline { archiveId: string; namespace: string; initialized: boolean;remoteRevision?:string; entries: Record<string, { nodeId: string; revision: string | null }> }
export type ExpectedRevision = { type: 'absent' } | { type: 'present'; revision: string; hash: string }
export interface RemoteChange { operationId: string; path: string; kind: 'put' | 'delete'; objectHash: string | null; nodeId: string; baseNodeId: string | null; expected: ExpectedRevision }
export interface ChangeBatch { id: string; endpointId: EndpointId; namespace: string; scanRevision: string; changes: RemoteChange[] }
export interface EndpointReceipt { batchId: string; endpointId: EndpointId; namespace: string; verifiedAt: string; committedRevision?: string; currentRevision?: string; complete: boolean;error?:{code:string;message:string;retryAfterMs?:number}; items: { operationId: string; path: string; status: 'confirmed' | 'conflict' | 'failed' | 'outcome_unknown'; hash?: string | null; revision?: string | null; error?: string }[] }
export interface EndpointAdapter { readonly id: EndpointId; readonly namespace: string; scan(): Promise<ScanResult>; read(path: string, revision: string): Promise<Buffer>; apply(batch: ChangeBatch): Promise<EndpointReceipt> }
export interface SyncEndpointInput { id: EndpointId; namespace: string; snapshot: ScanResult | null; base: EndpointBaseline | null; allowInitializeEmpty?: boolean }
export interface SyncInput { archiveId: string; checkpointRevision: number; local: ScanResult; localHeads: Record<string, string>; graph: Record<string, VersionNode>; objects: Record<string, Uint8Array>; availableObjects?:string[];endpoints: SyncEndpointInput[]; deletedRecordIds?: string[] }
export interface SyncConflict { id: string; path: string; reason: string; baseNodeId?: string; candidates: { nodeId: string; source: string; namespace?: string; objectHash: string | null }[] }
export interface SyncPlan {
  id: string; archiveId: string; checkpointRevision: number; graph: Record<string, VersionNode>; objects: Record<string, Uint8Array>; heads: Record<string, string>
  localChanges: { path: string; objectHash: string | null; expectedHash: string | null; nodeId: string }[]
  batches: ChangeBatch[]; acknowledgements: { endpointId: EndpointId; namespace: string; path: string; nodeId: string; revision: string | null }[]
  conflicts: SyncConflict[]; warnings: string[]
  requiredObjects:string[];initializedNamespaces:string[]
}
export type SyncReason='startup'|'manual'|'timer'|'local-change'
export type SyncPhase='idle'|'scanning'|'planning'|'applying'|'publishing'|'verifying'|'synced'|'pending'|'conflict'|'suspended'|'setup_required'
export interface SyncEndpointState{id:EndpointId;namespace:string;configRevision:number;phase:'idle'|'synced'|'pending'|'unauthorized'|'rate_limited'|'incomplete';lastAttemptAt:string|null;lastComparedAt:string|null;lastSuccessAt:string|null;lastUploadedAt:string|null;pending:number;blockedUntil:number;authBlockedRevision?:number;failures:number;error?:string;errorCode?:string}
export interface SyncComparison{id:string;at:string;complete:boolean;files:{path:string;target:string;action:string}[];conflicts:number}
export interface SyncState{schemaVersion:1;phase:SyncPhase;lastRunAt:string|null;localSavedAt:string|null;setupRequired:boolean;publishSuspended:boolean;endpoints:Partial<Record<EndpointId,SyncEndpointState>>;conflicts:SyncConflict[];changes:{path:string;target:string;action:string;at:string}[];warnings:string[];comparison?:SyncComparison}
export interface ResolveConflictInput{path:string;conflictId:string;nodeId:string|null;text?:string;keepBoth?:boolean}
