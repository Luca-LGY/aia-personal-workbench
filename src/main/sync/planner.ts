import type { SyncInput, SyncPlan, VersionNode, RemoteEntry, ScanResult, SyncConflict, EndpointBaseline } from '../../shared/sync'
import { contentHash, createVersion, digest, isAncestor, commonAncestor } from './graph'
import { mergeContent } from './merge'
interface Candidate { nodeId: string; source: string; namespace?: string }
function complete(scan: ScanResult | null) { return !!scan?.complete && scan.rootExists }
function entries(scan: ScanResult | null) { const result = new Map<string, RemoteEntry>(); for (const e of scan?.entries ?? []) { if (!e.path || e.path.startsWith('/') || e.path.split('/').some(p => p === '..' || p === '.') || e.path.includes('\0') || result.has(e.path)) throw Error('Invalid or duplicate snapshot path'); if (!/^[a-f0-9]{64}$/.test(e.hash)) throw Error('Invalid snapshot hash'); result.set(e.path, e) } return result }
export function planSync(input: SyncInput): SyncPlan {
  const graph = { ...input.graph }, objects = { ...input.objects }, heads: Record<string, string> = {}, local = entries(input.local)
  for (const [hash, bytes] of Object.entries(objects)) if (digest(bytes) !== hash) throw Error('Corrupt sync object')
  const endpoints = input.endpoints.map(e => ({ ...e, files: entries(e.snapshot), base: e.base?.archiveId === input.archiveId && e.base.namespace === e.namespace ? e.base : null as EndpointBaseline | null }))
  const available=new Set([...Object.keys(objects),...input.availableObjects??[]])
  const plan: SyncPlan = { id: '', archiveId: input.archiveId, checkpointRevision: input.checkpointRevision, graph, objects, heads, localChanges: [], batches: endpoints.map(e => ({ id: '', endpointId: e.id, namespace: e.namespace, scanRevision: e.snapshot?.revision ?? '', changes: [] })), acknowledgements: [], conflicts: [], warnings: [],requiredObjects:[],initializedNamespaces:endpoints.filter(e=>e.allowInitializeEmpty&&complete(e.snapshot)&&e.files.size===0).map(e=>e.namespace) }
  const paths = new Set([...local.keys(), ...Object.keys(input.localHeads), ...endpoints.flatMap(e => [...e.files.keys(), ...Object.keys(e.base?.entries ?? {})])])
  for (const e of endpoints) if (!complete(e.snapshot)) plan.warnings.push(e.id + '扫描未知或不完整，禁用本轮发布和基线推进')
  const deletedIds = new Set(input.deletedRecordIds ?? [])
  function observe(path: string, row: RemoteEntry | undefined, baseId: string | undefined, available: boolean, source: string, revision: string, namespace?: string): { candidate?: Candidate; resurrection: boolean } {
    const base = baseId ? graph[baseId] : undefined
    if (!row && !available) return { resurrection: false }
    if (!row && !base) return { resurrection: false }
    if (base && contentHash(base) === (row?.hash ?? null)) return { candidate: { nodeId: base.id, source, namespace }, resurrection: false }
    const resurrection = !!row && !row.restored && (base?.state.kind === 'deleted' || (!!row.recordId && deletedIds.has(row.recordId)))
    const state = row ? { kind: 'present' as const, hash: row.hash } : { kind: 'deleted' as const, priorHash: base ? contentHash(base) : null }
    const node = createVersion(path, state, base ? [base.id] : [], namespace ?? source, revision, { recordId: row?.recordId ?? base?.recordId, operation: row?.restored ? 'restore' : undefined })
    graph[node.id] = node
    return { candidate: { nodeId: node.id, source, namespace }, resurrection }
  }
  function conflict(path: string, reason: string, candidates: Candidate[], baseNodeId?: string) {
    const value: SyncConflict = { id: digest(path + reason + candidates.map(c => c.nodeId + (c.namespace ?? c.source)).sort().join()), path, reason, candidates: candidates.map(c => ({ ...c, objectHash: contentHash(graph[c.nodeId]) })), ...(baseNodeId ? { baseNodeId } : {}) }
    plan.conflicts.push(value)
  }
  for (const path of [...paths].sort()) {
    const observations = [observe(path, local.get(path), input.localHeads[path], complete(input.local), 'local', input.local.revision), ...endpoints.map(e => observe(path, e.files.get(path), e.base?.entries[path]?.nodeId, complete(e.snapshot), e.id, e.snapshot?.revision ?? 'unknown', e.namespace))]
    const candidates = observations.flatMap(o => o.candidate ? [o.candidate] : [])
    if (!candidates.length) continue
    if (observations.some(o => o.resurrection)) { conflict(path, '旧副本遇到删除历史；请显式恢复或保留删除', candidates); continue }
    const ids = [...new Set(candidates.map(c => c.nodeId))], leaves = ids.filter(id => !ids.some(other => id !== other && isAncestor(graph, id, other)))
    let selected: VersionNode
    if (leaves.length === 1) selected = graph[leaves[0]]
    else if (new Set(leaves.map(id => contentHash(graph[id]))).size === 1) {
      const exemplar = graph[leaves[0]]; selected = createVersion(path, exemplar.state, leaves, 'merge', 'equal-content', { recordId: exemplar.recordId, operation: 'merge' }); graph[selected.id] = selected
    } else {
      const baseId = commonAncestor(graph, leaves)
      if (leaves.some(id => graph[id].state.kind === 'deleted')) { conflict(path, '删除与编辑同时发生，保留全部版本', candidates, baseId ?? undefined); continue }
      if (!baseId || graph[baseId].state.kind === 'deleted') { conflict(path, '没有可靠共同祖先，保留双方内容', candidates); continue }
      const original = objects[contentHash(graph[baseId])!]
      if (!original) { conflict(path, '缺少共同祖先正文，请恢复基线对象', candidates, baseId); continue }
      let merged: Uint8Array | null = original
      for (const id of leaves.sort()) { const bytes = objects[contentHash(graph[id])!]; if (!bytes || !merged) { merged = null; break } merged = mergeContent(path, original, merged, bytes) }
      if (!merged) { conflict(path, '文本重叠、字段/数组或二进制并发修改', candidates, baseId); continue }
      const hash = digest(merged); objects[hash] = merged;available.add(hash); selected = createVersion(path, { kind: 'present', hash }, leaves, 'merge', baseId, { recordId: graph[leaves[0]].recordId, operation: 'merge' }); graph[selected.id] = selected
    }
    const desired = contentHash(selected)
    if (desired !== null && !available.has(desired)) { conflict(path, '缺少候选正文，未发起覆盖', candidates); continue }
    const unknownTarget = endpoints.find(e => complete(e.snapshot) && !e.files.has(path) && !e.base?.entries[path] && !e.base?.initialized && !(e.allowInitializeEmpty && e.files.size === 0) && desired !== null)
    if (unknownTarget) { conflict(path, unknownTarget.id + '首次接入缺少已确认基线；请先核对初始化范围', candidates); continue }
    if(complete(input.local)||(local.has(path)&&local.get(path)!.hash===desired))heads[path] = selected.id
    if (complete(input.local) && (local.get(path)?.hash ?? null) !== desired) plan.localChanges.push({ path, objectHash: desired, expectedHash: local.get(path)?.hash ?? null, nodeId: selected.id })
    for (const [index, e] of endpoints.entries()) {
      if (!complete(e.snapshot)) continue
      const row = e.files.get(path), current = row?.hash ?? null
      if (current === desired) { plan.acknowledgements.push({ endpointId: e.id, namespace: e.namespace, path, nodeId: selected.id, revision: row?.revision ?? null }); continue }
      const expected = row ? { type: 'present' as const, revision: row.revision, hash: row.hash } : { type: 'absent' as const }
      plan.batches[index].changes.push({ operationId: digest(e.namespace + path + selected.id + JSON.stringify(expected)), path, kind: desired === null ? 'delete' : 'put', objectHash: desired, nodeId: selected.id, baseNodeId: e.base?.entries[path]?.nodeId ?? null, expected })
    }
  }
  for (const batch of plan.batches) batch.id = digest(batch.namespace + batch.scanRevision + batch.changes.map(c => c.operationId).join())
  plan.requiredObjects=[...new Set(Object.values(graph).flatMap(n=>n.state.kind==='present'?[n.state.hash]:n.state.priorHash?[n.state.priorHash]:[]))]
  plan.id = digest(JSON.stringify({ archiveId: input.archiveId, checkpointRevision: input.checkpointRevision, local: input.local.revision, endpoints: plan.batches.map(b => b.id), heads, conflicts: plan.conflicts.map(c => c.id) }))
  return plan
}
