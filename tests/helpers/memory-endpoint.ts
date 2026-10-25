import type { EndpointAdapter, EndpointId, ScanResult, ChangeBatch, EndpointReceipt } from '../../src/shared/sync'
import { digest } from '../../src/main/sync/graph'
import { SyncError } from '../../src/main/sync/errors'
export class MemoryEndpoint implements EndpointAdapter {
  files = new Map<string, { bytes: Buffer; revision: string }>(); objects = new Map<string, Buffer>()
  offline = false; unauthorized = false; partial = false; rootExists = true; loseReplyOnce = false; failPaths = new Set<string>()
  writes = 0; commits = 0; reads = 0; scans = 0; retryAfterMs = 0; private counter = 0
  constructor(readonly id: EndpointId, readonly namespace = id + ':memory', private store?: { object(hash: string): Promise<Buffer>; putObject(hash: string, bytes: Uint8Array): Promise<void> }) {}
  set(path: string, value: string | Buffer) { const bytes = Buffer.from(value); this.files.set(path, { bytes, revision: 'memory-' + ++this.counter }); this.objects.set(digest(bytes), bytes) }
  delete(path: string) { this.files.delete(path); this.counter++ }
  private available() { if (this.unauthorized) throw new SyncError('unauthorized', 'Synthetic authentication rejection'); if (this.offline) throw new SyncError('offline', 'Synthetic offline'); if (this.retryAfterMs) throw new SyncError('rate_limited', 'Synthetic limit', this.retryAfterMs) }
  private revision() { return digest(JSON.stringify([...this.files].sort(([a], [b]) => a.localeCompare(b)).map(([p, f]) => [p, digest(f.bytes), f.revision]))) }
  async scan(): Promise<ScanResult> { this.available(); this.scans++; const all = [...this.files].sort(([a], [b]) => a.localeCompare(b)); for (const [, f] of all) await this.store?.putObject(digest(f.bytes), f.bytes); return { rootExists: this.rootExists, complete: !this.partial && this.rootExists, revision: this.revision(), entries: (this.partial ? all.slice(0, Math.floor(all.length / 2)) : all).map(([path, f]) => ({ path, hash: digest(f.bytes), revision: f.revision, size: f.bytes.length })) } }
  async read(path: string, revision: string) { this.available(); this.reads++; const file = this.files.get(path); if (!file) throw new SyncError('not_found', 'Synthetic missing file'); if (file.revision !== revision) throw new SyncError('conflict', 'Synthetic stale revision'); return Buffer.from(file.bytes) }
  async apply(batch: ChangeBatch): Promise<EndpointReceipt> {
    this.available(); if (batch.endpointId !== this.id || batch.namespace !== this.namespace) throw Error('Wrong namespace'); if (this.partial || !this.rootExists) throw new SyncError('incomplete', 'Incomplete synthetic scan')
    const receipt: EndpointReceipt = { batchId: batch.id, endpointId: this.id, namespace: this.namespace, verifiedAt: new Date().toISOString(), complete: true, items: [] }
    const matches = (c: ChangeBatch['changes'][number]) => { const f = this.files.get(c.path); return c.expected.type === 'absent' ? !f : !!f && f.revision === c.expected.revision && digest(f.bytes) === c.expected.hash }
    if (this.id === 'github' && (batch.scanRevision !== this.revision() || batch.changes.some(c => !matches(c)))) { receipt.complete = false; receipt.items = batch.changes.map(c => ({ operationId: c.operationId, path: c.path, status: 'conflict' })); return receipt }
    for (const c of batch.changes) {
      if (!matches(c)) { receipt.complete = false; receipt.items.push({ operationId: c.operationId, path: c.path, status: 'conflict' }); continue }
      if (this.failPaths.has(c.path)) { receipt.complete = false; receipt.items.push({ operationId: c.operationId, path: c.path, status: 'failed', error: 'Synthetic quota' }); continue }
      if (c.kind === 'put') { const bytes = this.store ? await this.store.object(c.objectHash!) : this.objects.get(c.objectHash!); if (!bytes || digest(bytes) !== c.objectHash) throw Error('Missing object'); this.set(c.path, bytes) } else this.delete(c.path)
      this.writes++; receipt.items.push({ operationId: c.operationId, path: c.path, status: 'confirmed', hash: c.objectHash, revision: c.kind === 'put' ? this.files.get(c.path)!.revision : null })
    }
    if (this.id === 'github' && batch.changes.length && receipt.complete) this.commits++
    receipt.currentRevision = this.revision(); receipt.committedRevision = this.id === 'github' ? receipt.currentRevision : undefined
    if (this.loseReplyOnce) { this.loseReplyOnce = false; throw new SyncError('outcome_unknown', 'Synthetic response lost after accepted write') }
    return receipt
  }
}
