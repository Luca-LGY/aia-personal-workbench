import type { EndpointId } from './connections'
export type { EndpointId } from './connections'
export interface RemoteEntry { path: string; hash: string; revision: string; size: number; recordId?: string; restored?: boolean }
export interface ScanResult { complete: boolean; rootExists: boolean; revision: string; entries: RemoteEntry[]; warnings?: string[] }
export type VersionState = { kind: 'present'; hash: string } | { kind: 'deleted'; priorHash: string | null }
export interface VersionNode { id: string; path: string; parents: string[]; state: VersionState; origin: string; operation: 'put' | 'delete' | 'merge' | 'restore'; recordId?: string }
export interface EndpointBaseline { archiveId: string; namespace: string; initialized: boolean; entries: Record<string, { nodeId: string; revision: string | null }> }
export type ExpectedRevision = { type: 'absent' } | { type: 'present'; revision: string; hash: string }
export interface RemoteChange { operationId: string; path: string; kind: 'put' | 'delete'; objectHash: string | null; nodeId: string; baseNodeId: string | null; expected: ExpectedRevision }
export interface ChangeBatch { id: string; endpointId: EndpointId; namespace: string; scanRevision: string; changes: RemoteChange[] }
export interface EndpointReceipt { batchId: string; endpointId: EndpointId; namespace: string; verifiedAt: string; committedRevision?: string; currentRevision?: string; complete: boolean; items: { operationId: string; path: string; status: 'confirmed' | 'conflict' | 'failed' | 'outcome_unknown'; hash?: string | null; revision?: string | null; error?: string }[] }
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
