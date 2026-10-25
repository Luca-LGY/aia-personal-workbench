import { createHash } from 'node:crypto'
import type { VersionNode, VersionState } from '../../shared/sync'
export const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
export function contentHash(node: VersionNode) { return node.state.kind === 'present' ? node.state.hash : null }
export function createVersion(path: string, state: VersionState, parents: string[], origin: string, observation: string, options: { recordId?: string; operation?: VersionNode['operation'] } = {}): VersionNode {
  const sorted = [...new Set(parents)].sort(), operation = options.operation ?? (state.kind === 'deleted' ? 'delete' : 'put')
  const id = digest(JSON.stringify({ path, state, parents: sorted, origin, observation, operation, recordId: options.recordId }))
  return { id, path, state, parents: sorted, origin, operation, ...(options.recordId ? { recordId: options.recordId } : {}) }
}
export function ancestors(graph: Record<string, VersionNode>, id: string) { const seen = new Set<string>(), queue = [id]; while (queue.length) { const next = queue.pop()!; if (seen.has(next)) continue; seen.add(next); for (const p of graph[next]?.parents ?? []) queue.push(p) } return seen }
export function isAncestor(graph: Record<string, VersionNode>, parent: string, child: string) { return ancestors(graph, child).has(parent) }
export function commonAncestor(graph: Record<string, VersionNode>, ids: string[]) { if (!ids.length) return null; const sets = ids.map(id => ancestors(graph, id)), common = [...sets[0]].filter(id => sets.every(s => s.has(id)) && !!graph[id]); const maximal = common.filter(id => !common.some(other => other !== id && isAncestor(graph, id, other))); return maximal.length === 1 ? maximal[0] : null }
