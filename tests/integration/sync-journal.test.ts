import { test, expect } from 'vitest'
import { mkdtemp, rm,writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createVersion, digest } from '../../src/main/sync/graph'
import { planSync } from '../../src/main/sync/planner'
import { SyncJournal } from '../../src/main/sync/journal'
import type { EndpointBaseline, EndpointReceipt, SyncInput } from '../../src/shared/sync'
function input(): SyncInput {
  const old = Buffer.from('old'), next = Buffer.from('new'), n = createVersion('a.md', { kind: 'present', hash: digest(old) }, [], 'local', 'initial')
  const entry = { path: 'a.md', hash: digest(old), revision: 'r-old', size: 3 }, base = (namespace: string): EndpointBaseline => ({ archiveId: 'test-archive', namespace, initialized: true, entries: { 'a.md': { nodeId: n.id, revision: 'r-old' } } })
  return { archiveId: 'test-archive', checkpointRevision: 0, graph: { [n.id]: n }, localHeads: { 'a.md': n.id }, objects: { [digest(old)]: old, [digest(next)]: next }, local: { revision: 'local-new', complete: true, rootExists: true, entries: [{ ...entry, hash: digest(next), revision: 'local-new' }] }, endpoints: ['webdav', 'github'].map(id => ({ id: id as 'webdav' | 'github', namespace: id + ':scope', base: base(id + ':scope'), snapshot: { revision: id + '-old', complete: true, rootExists: true, entries: [entry] } })) }
}
function receipt(p: ReturnType<typeof planSync>, index: number): EndpointReceipt { const b = p.batches[index]; return { endpointId: b.endpointId, namespace: b.namespace, batchId: b.id, complete: true, verifiedAt: '2026-10-26T00:00:00Z', items: b.changes.map(c => ({ operationId: c.operationId, path: c.path, status: 'confirmed', hash: c.objectHash, revision: 'confirmed-new' })) } }
async function setup() { const dir = await mkdtemp(join(tmpdir(), 'aia-journal-')), i = input(), journal = new SyncJournal(dir, i.archiveId); await journal.open(); await journal.initialize({ graph: i.graph, localHeads: i.localHeads, baselines: Object.fromEntries(i.endpoints.map(e => [e.namespace, e.base!])) }); return { dir, i, journal, close: () => rm(dir, { recursive: true, force: true }) } }
test('confirmed receipt and corresponding baseline advance together; other endpoint remains at its own base after restart', async () => {
  const t = await setup(); try {
    const p = planSync(t.i); await t.journal.prepare(p); await t.journal.recordLocalApplied(p.id)
    await t.journal.recordReceipt(p.id, receipt(p, 0))
    const reopened = new SyncJournal(t.dir, t.i.archiveId); await reopened.open(); const state = reopened.getState()
    expect(state.baselines['webdav:scope'].entries['a.md'].nodeId).toBe(p.heads['a.md'])
    expect(state.baselines['github:scope'].entries['a.md'].nodeId).toBe(t.i.localHeads['a.md'])
    const pending = reopened.recover(); expect(pending).toHaveLength(1)
    expect(pending[0].operations.filter(o => o.status === 'pending').map(o => o.endpointId)).toEqual(['github'])
    expect((await reopened.object(digest('new'))).toString()).toBe('new')
    await reopened.recordReceipt(p.id, receipt(p, 0)); expect(reopened.getState().baselines['webdav:scope'].entries['a.md'].nodeId).toBe(p.heads['a.md'])
  } finally { await t.close() }
})
test('unknown outcome never advances baseline and is recovered for readback before any replay', async () => {
  const t = await setup(); try {
    const p = planSync(t.i); await t.journal.prepare(p); const r = receipt(p, 0); r.complete = false; r.items[0].status = 'outcome_unknown'; delete r.items[0].revision
    await t.journal.recordReceipt(p.id, r)
    const reopened = new SyncJournal(t.dir, t.i.archiveId); await reopened.open()
    expect(reopened.getState().baselines['webdav:scope'].entries['a.md'].nodeId).toBe(t.i.localHeads['a.md'])
    expect(reopened.recover()[0].operations[0].status).toBe('outcome_unknown')
    await expect(reopened.recordReceipt(p.id, { ...receipt(p, 0), namespace: 'webdav:different-account' })).rejects.toThrow('namespace')
  } finally { await t.close() }
})
test('prepared crash retains every required object and operation; stale plan cannot replace newer checkpoint', async () => {
  const t = await setup(); try {
    const p = planSync(t.i), failing = new SyncJournal(t.dir, t.i.archiveId, stage => { if (stage === 'prepared') throw Error('SIMULATED_CRASH') }); await failing.open()
    await expect(failing.prepare(p)).rejects.toThrow('SIMULATED_CRASH')
    const reopened = new SyncJournal(t.dir, t.i.archiveId); await reopened.open()
    expect(reopened.recover()[0].operations).toHaveLength(2)
    expect((await reopened.object(digest('old'))).toString()).toBe('old')
    expect((await reopened.object(digest('new'))).toString()).toBe('new')
    await expect(reopened.prepare({ ...p, id: 'different-stale-plan' })).rejects.toThrow('STALE_CHECKPOINT')
  } finally { await t.close() }
})
test('crash after saving receipt reopens with confirmation and baseline already advanced', async () => {
  const t = await setup(); try {
    const p = planSync(t.i); await t.journal.prepare(p); await t.journal.recordLocalApplied(p.id)
    const failing = new SyncJournal(t.dir, t.i.archiveId, stage => { if (stage === 'receipt') throw Error('SIMULATED_CRASH') }); await failing.open()
    await expect(failing.recordReceipt(p.id, receipt(p, 0))).rejects.toThrow('SIMULATED_CRASH')
    const next = new SyncJournal(t.dir, t.i.archiveId); await next.open()
    expect(next.recover()[0].operations.find(o => o.endpointId === 'webdav')?.status).toBe('confirmed')
    expect(next.getState().baselines['webdav:scope'].entries['a.md'].nodeId).toBe(p.heads['a.md'])
    await next.recordReceipt(p.id, receipt(p, 1)); expect(await next.finish(p.id)).toBe(true); expect(next.recover()).toHaveLength(0)
  } finally { await t.close() }
})
test('late receipt for superseded run cannot change the base or erase a newer observed conflict', async () => {
  const t = await setup(); try {
    const first = planSync(t.i); await t.journal.prepare(first); await t.journal.recordLocalApplied(first.id); await t.journal.supersede(first.id)
    function currentInput(): SyncInput { const state = t.journal.getState(); return { ...t.i, checkpointRevision: state.revision, graph: state.graph, localHeads: state.localHeads, objects: { ...t.i.objects, [digest('remote-C')]: Buffer.from('remote-C') }, endpoints: t.i.endpoints.map(e => ({ ...e, base: state.baselines[e.namespace], snapshot: e.id === 'webdav' ? { ...e.snapshot!, revision: 'remote-C-scan', entries: [{ path: 'a.md', hash: digest('remote-C'), revision: 'remote-C-revision', size: 8 }] } : e.snapshot })) } }
    const second = planSync(currentInput()); expect(second.conflicts).toHaveLength(1); await t.journal.prepare(second)
    await t.journal.recordReceipt(first.id, receipt(first, 0))
    expect(t.journal.getState().baselines['webdav:scope'].entries['a.md'].nodeId).toBe(t.i.localHeads['a.md'])
    expect(planSync(currentInput()).conflicts).toHaveLength(1)
  } finally { await t.close() }
})
test('corrupt stored baseline referenced without in-memory bytes blocks preparation before publishing', async () => {
  const t = await setup(); try {
    for(const [hash,bytes] of Object.entries(t.i.objects))await t.journal.putObject(hash,bytes)
    await t.journal.object(digest('old'))
    await writeFile(join(t.dir,'state/objects',digest('old')),'bad')
    const p=planSync({...t.i,objects:{},availableObjects:Object.keys(t.i.objects)})
    expect(p.conflicts).toHaveLength(0)
    await expect(t.journal.prepare(p)).rejects.toThrow('CORRUPT')
    expect(t.journal.recover()).toHaveLength(0)
  }finally{await t.close()}
})
