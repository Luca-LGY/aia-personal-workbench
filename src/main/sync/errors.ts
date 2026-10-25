export type SyncErrorCode = 'unauthorized' | 'rate_limited' | 'quota' | 'offline' | 'conflict' | 'incomplete' | 'unsupported' | 'not_found' | 'outcome_unknown'
export class SyncError extends Error { constructor(readonly code: SyncErrorCode, message: string, readonly retryAfterMs?: number) { super(message); this.name = 'SyncError' } }
