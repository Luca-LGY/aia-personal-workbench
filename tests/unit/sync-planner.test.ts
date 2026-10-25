import { test, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { createVersion, contentHash } from '../../src/main/sync/graph'
import { planSync } from '../../src/main/sync/planner'
import type { SyncInput, ScanResult, VersionNode } from '../../src/shared/sync'
import { makeRecord } from '../../src/shared/schemas'
import { serializeRecord, parseDocument } from '../../src/main/archive/codec'
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const entry = (path: string, text: string) => ({ path, hash: hash(text), revision: 'rev-' + hash(text), size: Buffer.byteLength(text) })
const scan = (files: Record<string, string>, revision = 'scan', complete = true): ScanResult => ({ complete, rootExists: true, revision, entries: Object.entries(files).map(([p, t]) => entry(p, t)) })
function setup(files: Record<string, string>): SyncInput {
  const graph: Record<string, VersionNode> = {}, localHeads: Record<string, string> = {}, baseEntries: Record<string, { nodeId: string; revision: string | null }> = {}, objects: Record<string, Uint8Array> = {}
  for (const [path, text] of Object.entries(files)) { const n = createVersion(path, { kind: 'present', hash: hash(text) }, [], 'local', 'initial'); graph[n.id] = n; localHeads[path] = n.id; baseEntries[path] = { nodeId: n.id, revision: entry(path, text).revision }; objects[hash(text)] = Buffer.from(text) }
  return { archiveId: 'test-archive', checkpointRevision: 0, local: scan(files, 'local'), localHeads, graph, objects, endpoints: ['webdav', 'github'].map(id => ({ id: id as 'webdav' | 'github', namespace: id + ':test', snapshot: scan(files, id), base: { archiveId: 'test-archive', namespace: id + ':test', initialized: true, entries: structuredClone(baseEntries) } })) }
}
function change(input: SyncInput, target: 'local' | 'webdav' | 'github', files: Record<string, string>) { for (const text of Object.values(files)) input.objects[hash(text)] = Buffer.from(text); if (target === 'local') input.local = scan(files, 'local-edit'); else input.endpoints.find(e => e.id === target)!.snapshot = scan(files, target + '-edit') }
test('identical contents write nothing; a local edit propagates conditionally to both endpoints', () => {
  const input = setup({ 'a.md': 'old' }), same = planSync(input)
  expect(same.localChanges).toHaveLength(0); expect(same.batches.every(b => b.changes.length === 0)).toBe(true)
  change(input, 'local', { 'a.md': 'new' }); const next = planSync(input)
  expect(next.conflicts).toHaveLength(0); expect(next.batches.map(b => b.changes.length)).toEqual([1, 1])
  expect(next.batches[0].changes[0].expected.type).toBe('present')
})
test('three endpoints changing different files preserve every edit in a single plan', () => {
  const input = setup({ 'a.md': 'a0', 'b.md': 'b0', 'c.md': 'c0' })
  change(input, 'local', { 'a.md': 'a1', 'b.md': 'b0', 'c.md': 'c0' }); change(input, 'webdav', { 'a.md': 'a0', 'b.md': 'b1', 'c.md': 'c0' }); change(input, 'github', { 'a.md': 'a0', 'b.md': 'b0', 'c.md': 'c1' })
  const p = planSync(input); expect(p.conflicts).toHaveLength(0); expect(p.localChanges.map(c => c.path).sort()).toEqual(['b.md', 'c.md'])
  for (const [path, text] of Object.entries({ 'a.md': 'a1', 'b.md': 'b1', 'c.md': 'c1' })) expect(contentHash(p.graph[p.heads[path]])).toBe(hash(text))
})
test('nonoverlapping three-way line edits merge while overlapping edits retain all candidates', () => {
  const base = 'one\ntwo\nthree\nfour\nfive\n', input = setup({ 'a.md': base })
  change(input, 'local', { 'a.md': base.replace('one', 'ONE') }); change(input, 'webdav', { 'a.md': base.replace('three', 'THREE') }); change(input, 'github', { 'a.md': base.replace('five', 'FIVE') })
  const p = planSync(input); expect(p.conflicts).toHaveLength(0)
  expect(Buffer.from(p.objects[contentHash(p.graph[p.heads['a.md']])!]).toString()).toBe('ONE\ntwo\nTHREE\nfour\nFIVE\n')
  change(input, 'webdav', { 'a.md': base.replace('one', 'W') }); change(input, 'github', { 'a.md': base.replace('one', 'G') })
  const conflict = planSync(input); expect(conflict.conflicts[0].candidates).toHaveLength(3); expect(conflict.localChanges).toHaveLength(0); expect(conflict.batches.every(b => !b.changes.length)).toBe(true)
})
test('delete versus edit conflicts; incomplete and missing-root scans never imply deletion', () => {
  const input = setup({ 'a.md': 'old' }); change(input, 'local', {}); change(input, 'webdav', { 'a.md': 'changed' })
  expect(planSync(input).conflicts[0].reason).toContain('删除')
  const incomplete = setup({ 'a.md': 'old' }); incomplete.endpoints[0].snapshot = scan({}, 'partial', false)
  expect(planSync(incomplete).localChanges).toHaveLength(0); expect(planSync(incomplete).batches[0].changes).toHaveLength(0)
  incomplete.endpoints[0].snapshot = { ...scan({}, 'missing', false), rootExists: false }
  expect(planSync(incomplete).localChanges).toHaveLength(0)
})
test('unknown ancestry and switched namespace never authorize overwrites; explicit empty initialization is required', () => {
  const input = setup({ 'a.md': 'local' }); input.endpoints = [input.endpoints[0]]; input.endpoints[0].base = null
  change(input, 'webdav', { 'a.md': 'remote' }); expect(planSync(input).conflicts[0].reason).toContain('祖先')
  input.endpoints[0].snapshot = scan({}, 'empty'); expect(planSync(input).batches[0].changes).toHaveLength(0)
  input.endpoints[0].allowInitializeEmpty = true; expect(planSync(input).batches[0].changes).toHaveLength(1)
  input.endpoints[0].snapshot = { ...scan({}, 'missing'), rootExists: false }; expect(planSync(input).batches[0].changes).toHaveLength(0)
  const switched = setup({ 'a.md': 'old' }); switched.endpoints[0].namespace = 'webdav:different-account'; change(switched, 'webdav', { 'a.md': 'different' }); expect(planSync(switched).conflicts.length).toBeGreaterThan(0)
})
test('independent endpoint bases preserve changes already contained in a newer base', () => {
  const original = 'one\ntwo\nthree\nfour\nfive\nsix\nseven\n', a = original.replace('one', 'A'), b = a.replace('three', 'B'), input = setup({ 'a.md': a }), aNode = input.graph[input.localHeads['a.md']]
  const bNode = createVersion('a.md', { kind: 'present', hash: hash(b) }, [aNode.id], 'local', 'second'); input.graph[bNode.id] = bNode; input.objects[hash(b)] = Buffer.from(b); input.localHeads['a.md'] = bNode.id
  input.endpoints[1].base!.entries['a.md'] = { nodeId: bNode.id, revision: entry('a.md', b).revision }
  change(input, 'local', { 'a.md': b }); change(input, 'webdav', { 'a.md': a.replace('five', 'W') }); change(input, 'github', { 'a.md': b.replace('seven', 'G') })
  const p = planSync(input); expect(p.conflicts).toHaveLength(0); expect(Buffer.from(p.objects[contentHash(p.graph[p.heads['a.md']])!]).toString()).toBe('A\ntwo\nB\nfour\nW\nsix\nG\n')
})
test('old copies cannot resurrect deletion, while explicit restore creates a descendant with separate identity', () => {
  const input = setup({ 'a.md': 'old' }), old = input.localHeads['a.md'], deleted = createVersion('a.md', { kind: 'deleted', priorHash: hash('old') }, [old], 'local', 'deleted')
  input.graph[deleted.id] = deleted; input.localHeads['a.md'] = deleted.id
  for (const e of input.endpoints) { e.base!.entries['a.md'] = { nodeId: deleted.id, revision: null }; e.snapshot = scan({}, e.id + '-deleted') }
  expect(planSync(input).conflicts[0].reason).toContain('恢复')
  input.local.entries[0].restored = true; const restored = planSync(input)
  expect(restored.conflicts).toHaveLength(0); expect(restored.heads['a.md']).not.toBe(old); expect(restored.graph[restored.heads['a.md']].parents).toContain(deleted.id)
})
test('JSON fields merge independently but concurrent arrays remain a conflict', () => {
  const input = setup({ 'a.json': JSON.stringify({ a: 1, b: 1, items: [1] }) })
  change(input, 'local', { 'a.json': JSON.stringify({ a: 2, b: 1, items: [1] }) }); change(input, 'webdav', { 'a.json': JSON.stringify({ a: 1, b: 2, items: [1] }) })
  const p = planSync(input); expect(p.conflicts).toHaveLength(0); expect(JSON.parse(Buffer.from(p.objects[contentHash(p.graph[p.heads['a.json']])!]).toString())).toEqual({ a: 2, b: 2, items: [1] })
  change(input, 'local', { 'a.json': JSON.stringify({ a: 1, b: 1, items: [2] }) }); change(input, 'webdav', { 'a.json': JSON.stringify({ a: 1, b: 1, items: [3] }) }); expect(planSync(input).conflicts).toHaveLength(1)
})
test('same bytes restored from an older present version have a new causal version ID', () => {
  const input = setup({ 'a.md': 'first' }), old = input.localHeads['a.md'], newer = createVersion('a.md', { kind: 'present', hash: hash('second') }, [old], 'local', 'newer')
  input.graph[newer.id] = newer; input.objects[hash('second')] = Buffer.from('second'); input.localHeads['a.md'] = newer.id
  for (const e of input.endpoints) { e.base!.entries['a.md'] = { nodeId: newer.id, revision: entry('a.md', 'second').revision }; e.snapshot = scan({ 'a.md': 'second' }) }
  const p = planSync(input); expect(p.heads['a.md']).not.toBe(old); expect(p.graph[p.heads['a.md']].parents).toEqual([newer.id]); expect(contentHash(p.graph[p.heads['a.md']])).toBe(hash('first'))
})
test('typed Markdown merges structured metadata and body while keeping unknown fields', () => {
  const base = makeRecord('note', { title: '笔记', module: 'learning', body: '第一行\n第二行\n第三行', data: { nextStep: '原下一步', custom: '保留字段' } }), original = serializeRecord(base).toString(), input = setup({ 'a.md': original })
  change(input, 'local', { 'a.md': serializeRecord({ ...base, body: '新第一行\n第二行\n第三行', updatedAt: '2026-10-26T01:00:00Z' }).toString() })
  change(input, 'webdav', { 'a.md': serializeRecord({ ...base, data: { ...base.data, nextStep: '更新下一步' }, updatedAt: '2026-10-26T02:00:00Z' }).toString() })
  const p = planSync(input); expect(p.conflicts).toHaveLength(0)
  const parsed = parseDocument(Buffer.from(p.objects[contentHash(p.graph[p.heads['a.md']])!]), 'a.md')
  expect(parsed.status).toBe('record'); if (parsed.status !== 'record') throw Error('Expected typed record')
  expect(parsed.record.body).toContain('新第一行'); expect(parsed.record.data).toMatchObject({ nextStep: '更新下一步', custom: '保留字段' })
})
test('binary concurrent edits conflict, and known stored objects can be scheduled without loading bytes', () => {
  const concurrent = setup({ 'photo.png': 'old' }); change(concurrent, 'local', { 'photo.png': 'local' }); change(concurrent, 'webdav', { 'photo.png': 'cloud' }); expect(planSync(concurrent).conflicts).toHaveLength(1)
  const stored = setup({ 'photo.png': 'old' }); change(stored, 'local', { 'photo.png': 'new' }); stored.availableObjects = Object.keys(stored.objects); delete stored.objects[hash('new')]
  const p = planSync(stored); expect(p.conflicts).toHaveLength(0); expect(p.batches[0].changes[0].objectHash).toBe(hash('new'))
})
test('incomplete local scan cannot advance its head to bytes that were never applied', () => {
  const input = setup({ 'a.md': 'old' }); change(input, 'webdav', { 'a.md': 'remote-new' }); input.local.complete = false
  const first = planSync(input); expect(first.localChanges).toHaveLength(0)
  const localHeads = { ...input.localHeads, ...first.heads }
  const ack = first.acknowledgements.find(a => a.endpointId === 'webdav' && a.path === 'a.md')!
  const next: SyncInput = { ...input, graph: first.graph, objects: first.objects, localHeads, local: { ...input.local, complete: true }, endpoints: input.endpoints.map(e => e.id === 'webdav' ? { ...e, base: { ...e.base!, entries: { ...e.base!.entries, 'a.md': { nodeId: ack.nodeId, revision: ack.revision } } } } : e) }
  const result = planSync(next)
  expect(result.localChanges).toMatchObject([{ path: 'a.md', objectHash: hash('remote-new'), expectedHash: hash('old') }])
  expect(result.batches.every(b => !b.changes.some(c => c.objectHash === hash('old')))).toBe(true)
})
