import merge from 'diff3'
import { isDeepStrictEqual } from 'node:util'
import { parseDocument, serializeRecord } from '../archive/codec'
const absent = Symbol('absent')
function object(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v) }
function fields(base: unknown, a: unknown, b: unknown, key = ''): unknown {
  if (isDeepStrictEqual(a, b)) return a
  if (isDeepStrictEqual(a, base)) return b
  if (isDeepStrictEqual(b, base)) return a
  if (key === 'updatedAt' && typeof a === 'string' && typeof b === 'string' && Number.isFinite(Date.parse(a)) && Number.isFinite(Date.parse(b))) return Date.parse(a) > Date.parse(b) ? a : b
  if (object(base) && object(a) && object(b)) { const result: Record<string, unknown> = {}; for (const k of new Set([...Object.keys(base), ...Object.keys(a), ...Object.keys(b)])) { const value = fields(k in base ? base[k] : absent, k in a ? a[k] : absent, k in b ? b[k] : absent, k); if (value !== absent) result[k] = value } return result }
  throw Error('Concurrent field or array change')
}
function lines(base: string, a: string, b: string) { const blocks = merge(a.split('\n'), base.split('\n'), b.split('\n')); if (blocks.some(block => 'conflict' in block)) throw Error('Overlapping lines'); return blocks.flatMap(block => 'ok' in block ? block.ok : []).join('\n') }
export function mergeContent(path: string, base: Uint8Array, a: Uint8Array, b: Uint8Array): Buffer | null {
  try {
    const bytes = [base, a, b].map(v => Buffer.from(v)), text = bytes.map(v => v.toString('utf8'))
    if (bytes.some((v, i) => v.includes(0) || !Buffer.from(text[i]).equals(v))) return null
    if (path.endsWith('.json')) return Buffer.from(JSON.stringify(fields(...text.map(t => JSON.parse(t)) as [unknown, unknown, unknown]), null, 2) + '\n')
    if (!/\.(md|txt|csv|ya?ml)$/i.test(path)) return null
    if (path.endsWith('.md')) {
      const parsed = bytes.map(v => parseDocument(v, path))
      if (parsed.every(p => p.status === 'record')) {
        const records = parsed.map(p => { if (p.status !== 'record') throw Error(); return p.record }), body = lines(records[0].body, records[1].body, records[2].body)
        const metadata = records.map(r => ({ ...r, body: '' }))
        return serializeRecord({ ...fields(metadata[0], metadata[1], metadata[2]) as typeof records[0], body })
      }
    }
    return Buffer.from(lines(text[0], text[1], text[2]))
  } catch { return null }
}
