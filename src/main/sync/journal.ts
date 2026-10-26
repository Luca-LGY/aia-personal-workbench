import { join } from 'node:path'
import { stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import type { EndpointBaseline, EndpointReceipt, SyncConflict, SyncPlan, VersionNode, ChangeBatch } from '../../shared/sync'
import { atomicWrite, readMaybe } from '../archive/transactions'
import { digest, contentHash, isAncestor } from './graph'
import { safePath } from '../archive/paths'
import { ingestObject } from './streams'
type StoredPlan = Omit<SyncPlan, 'objects' | 'graph'>
export interface JournalOperation { operationId: string; endpointId: ChangeBatch['endpointId']; namespace: string; path: string; status: 'pending' | 'outcome_unknown' | 'confirmed' | 'conflict' | 'failed'; receipt?: EndpointReceipt['items'][number];historical?:boolean }
export interface JournalRun { id: string; plan: StoredPlan; phase: 'prepared' | 'local_applied' | 'complete' | 'superseded'; operations: JournalOperation[]; createdAt: string }
export interface JournalState { schemaVersion: 1; archiveId: string; revision: number; graph: Record<string, VersionNode>; localHeads: Record<string, string>; baselines: Record<string, EndpointBaseline>; conflicts: Record<string, SyncConflict>; runs: Record<string, JournalRun>; publishSuspendedForRestore: boolean }
export class SyncJournal {
  private value: JournalState; private tail: Promise<unknown> = Promise.resolve(); private existed = false
  private integrity=new Map<string,string>();private blocked=false
  private assertWritable(){if(this.blocked)throw Error('同步历史无法读取，CHECKPOINT_BLOCKED；请从完整备份恢复，原文件已保留。')}
  constructor(private root: string, private archiveId: string, private onStage?: (stage: 'objects' | 'prepared' | 'receipt') => void) {
    if (!/^[\w-]+$/.test(archiveId)) throw Error('Invalid archive ID')
    this.value = { schemaVersion: 1, archiveId, revision: 0, graph: {}, localHeads: {}, baselines: {}, conflicts: {}, runs: {}, publishSuspendedForRestore: false }
  }
  private path() { return join(this.root, 'state/sync', this.archiveId, 'checkpoint.json') }
  async open() { try{const bytes = await readMaybe(this.path()); if (bytes) { const value = JSON.parse(bytes.toString()) as JournalState; if (value.schemaVersion !== 1 || value.archiveId !== this.archiveId || !value.graph || !value.runs) throw Error('Invalid sync checkpoint'); this.value = value; this.existed = true } }catch(e){this.blocked=true;throw e} }
  getState() { return structuredClone(this.value) }
  private queue<T>(work: () => Promise<T>) { const next = this.tail.then(()=>{this.assertWritable();return work()}); this.tail = next.catch(() => {}); return next }
  private async save(next: JournalState) { this.assertWritable(); await atomicWrite(this.path(), JSON.stringify(next)); this.value = next; this.existed = true }
  private async update(work: (next: JournalState) => void) { const next = this.getState(); work(next); next.revision++; await this.save(next) }
  initialize(state: Pick<JournalState, 'graph' | 'localHeads' | 'baselines'>) { return this.queue(async () => { if (this.existed) throw Error('Checkpoint already initialized'); await this.save({ ...this.value, ...structuredClone(state) }) }) }
  async putObject(hash: string, bytes: Uint8Array) { this.assertWritable(); if (!/^[a-f0-9]{64}$/.test(hash) || digest(bytes) !== hash) throw Error('CORRUPT_OBJECT'); const p = join(this.root, 'state/objects', hash), prior = await readMaybe(p); if (prior && digest(prior) !== hash) throw Error('CORRUPT_STORED_OBJECT'); if (!prior) await atomicWrite(p, Buffer.from(bytes)) }
  private async objectLocation(hash:string){if(!/^[a-f0-9]{64}$/.test(hash))throw Error('Invalid object hash');return safePath(this.root,join('state/objects',hash))}
  private async signature(path:string){const s=await stat(path,{bigint:true});if(!s.isFile())throw Error('CORRUPT_OBJECT');return[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':')}
  async verifyObject(hash:string){
    const path=await this.objectLocation(hash);let before:string
    try{before=await this.signature(path)}catch{throw Error('MISSING_OR_CORRUPT_OBJECT: '+hash)}
    if(this.integrity.get(hash)===before)return
    const checksum=createHash('sha256');for await(const chunk of createReadStream(path))checksum.update(chunk)
    if(checksum.digest('hex')!==hash||await this.signature(path)!==before){this.integrity.delete(hash);throw Error('CORRUPT_STORED_OBJECT: '+hash)}
    this.integrity.set(hash,before)
  }
  async objectPath(hash:string){await this.verifyObject(hash);return this.objectLocation(hash)}
  async hasObject(hash:string){try{return(await stat(await this.objectLocation(hash))).isFile()}catch{return false}}
  async ingest(source:AsyncIterable<Uint8Array>,expectedHash?:string){this.assertWritable();const result=await ingestObject(this.root,source,expectedHash);this.integrity.delete(result.hash);return result}
  async object(hash: string) { await this.verifyObject(hash);const bytes = await readMaybe(await this.objectLocation(hash)); if (!bytes || digest(bytes) !== hash){this.integrity.delete(hash);throw Error('MISSING_OR_CORRUPT_OBJECT: ' + hash)}return bytes }
  prepare(plan: SyncPlan) { return this.queue(async () => {
    if (plan.archiveId !== this.archiveId) throw Error('Wrong archive')
    if (this.value.runs[plan.id]) return plan.id
    if (plan.checkpointRevision !== this.value.revision) throw Error('STALE_CHECKPOINT')
    for (const [hash, bytes] of Object.entries(plan.objects)) await this.putObject(hash, bytes)
    for(const hash of plan.requiredObjects)await this.verifyObject(hash)
    this.onStage?.('objects')
    const { objects: _objects, graph, ...stored } = plan
    void _objects
    await this.update(next => {
      Object.assign(next.graph, graph)
      for(const namespace of plan.initializedNamespaces)this.baseline(next,namespace).initialized=true
      for (const c of plan.conflicts) next.conflicts[c.path] = c
      next.runs[plan.id] = { id: plan.id, plan: stored, phase: 'prepared', createdAt: new Date().toISOString(), operations: plan.batches.flatMap(b => b.changes.map(c => ({ operationId: c.operationId, endpointId: b.endpointId, namespace: b.namespace, path: c.path, status: 'pending' as const }))) }
    })
    this.onStage?.('prepared'); return plan.id
  }) }
  private baseline(next: JournalState, namespace: string) { return next.baselines[namespace] ??= { archiveId: this.archiveId, namespace, initialized: false, entries: {} } }
  private advance(next: JournalState, namespace: string, path: string, nodeId: string, revision: string | null) {
    const base = this.baseline(next, namespace), current = base.entries[path]?.nodeId
    if (current && current !== nodeId && isAncestor(next.graph, nodeId, current)) return
    if (current && current !== nodeId && !isAncestor(next.graph, current, nodeId)) throw Error('STALE_BASELINE')
    base.entries[path] = { nodeId, revision }
  }
  recordLocalApplied(runId: string) { return this.queue(async () => this.update(next => {
    const run = next.runs[runId]; if (!run) throw Error('Unknown run'); if (run.phase !== 'prepared') return
    Object.assign(next.localHeads, run.plan.heads)
    for (const ack of run.plan.acknowledgements) this.advance(next, ack.namespace, ack.path, ack.nodeId, ack.revision)
    run.phase = 'local_applied'
  })) }
  recordReceipt(runId: string, receipt: EndpointReceipt) { return this.queue(async () => {
    await this.update(next => {
      const run = next.runs[runId]; if (!run) throw Error('Unknown run')
      const batch = run.plan.batches.find(b => b.id === receipt.batchId && b.namespace === receipt.namespace && b.endpointId === receipt.endpointId)
      if (!batch) throw Error('Receipt namespace or batch mismatch')
      const seen = new Set<string>()
      for (const item of receipt.items) {
        if (seen.has(item.operationId)) throw Error('Duplicate receipt operation'); seen.add(item.operationId)
        const change = batch.changes.find(c => c.operationId === item.operationId && c.path === item.path), operation = run.operations.find(o => o.operationId === item.operationId && o.namespace === receipt.namespace)
        if (!change || !operation) throw Error('Unknown receipt operation')
        if (operation.status === 'confirmed') continue
        if (item.status === 'confirmed') {
          if (item.hash !== change.objectHash || (change.kind === 'put' && (typeof item.revision !== 'string' || !item.revision))) throw Error('Unverified receipt content')
          if (contentHash(next.graph[change.nodeId]) !== item.hash) throw Error('Receipt graph mismatch')
          if(run.phase==='superseded')operation.historical=true
          else this.advance(next, batch.namespace, change.path, change.nodeId, item.revision ?? null)
        }
        operation.status = item.status; operation.receipt = structuredClone(item)
      }
    })
    this.onStage?.('receipt')
  }) }
  finish(runId: string) { return this.queue(async () => { let done = false; await this.update(next => { const run = next.runs[runId]; if (!run) throw Error('Unknown run'); if (run.phase === 'local_applied' && run.operations.every(o => o.status === 'confirmed')) { run.phase = 'complete'; done = true } }); return done }) }
  supersede(runId: string) { return this.queue(async () => this.update(next => { const run = next.runs[runId]; if (run) run.phase = 'superseded' })) }
  setBaseline(baseline: EndpointBaseline) { return this.queue(async () => this.update(next => { if (baseline.archiveId !== this.archiveId) throw Error('Wrong archive baseline'); next.baselines[baseline.namespace] = structuredClone(baseline) })) }
  suspendForRestore(value = true) { return this.queue(async () => this.update(next => { next.publishSuspendedForRestore = value })) }
  replaceConflicts(conflicts:SyncConflict[],complete:boolean){return this.queue(async()=>this.update(next=>{if(complete)next.conflicts={};for(const c of conflicts)next.conflicts[c.path]=structuredClone(c)}))}
  clearConflict(path:string,id:string){return this.queue(async()=>this.update(next=>{if(next.conflicts[path]?.id!==id)throw Error('冲突已变化，请重新比较');delete next.conflicts[path]}))}
  recover() { return Object.values(this.getState().runs).filter(r => r.phase === 'prepared' || r.phase === 'local_applied') }
  idle() { return this.tail }
}
