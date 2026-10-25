import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import type { GarminActivity, GarminOverview } from '../../shared/garmin'
import { safePath, walkFiles } from '../archive/paths'
import { hashBytes } from '../archive/codec'
import { readMaybe } from '../archive/transactions'
import { normalizeSnapshot, object } from './normalizer'

function cells(line: string) { return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim()) }
function numeric(value: string) { const n = Number(value); return value.trim() && Number.isFinite(n) && n >= 0 ? n : null }
export function markdownActivities(body: string, path: string): GarminActivity[] {
  const result: GarminActivity[] = []; let header: string[] = []
  for (const line of body.split('\n')) {
    if (!line.trim().startsWith('|')) { header = []; continue }
    const row = cells(line)
    if (row.some(s => /活动\s*ID/i.test(s))) { header = row; continue }
    if (!header.length || row.every(s => /^[-:\s]*$/.test(s))) continue
    const at = (re: RegExp) => row[header.findIndex(s => re.test(s))] ?? ''
    const id = at(/活动\s*ID/i).replace(/`/g, '').replace(/^\[([^\]]+)\]\([^)]*\)$/, '$1').trim(), startTime = at(/当地日期时间|开始时间/)
    if (!id || !/^\d{4}-\d{2}-\d{2}/.test(startTime)) continue
    result.push({ id, name: at(/活动名/) || '历史活动', type: at(/^类型$/), date: startTime.slice(0, 10), startTime, distanceKm: numeric(at(/^km$/i)), durationMin: numeric(at(/^分钟$/)), source: { path, hash: hashBytes(body) } })
  }
  return result
}
export class GarminArchiveReader {
  constructor(private root: string, private now: () => Date = () => new Date()) {}
  async readOverview(date: string): Promise<GarminOverview> {
    z.iso.date().parse(date)
    const paths = (await walkFiles(this.root)).filter(p => /^运动\/数据\//.test(p) && /(?:佳明快照|周度复盘快照[^/]*)\.json$/.test(p))
    const snapshots: { path: string; value: unknown; quality: unknown; hash: string; stamp: string }[] = [], failures: string[] = []
    for (const path of paths) { try {
      const bytes = await readFile(await safePath(this.root, path)), value: unknown = JSON.parse(bytes.toString()), s = object(value), qPath = join(dirname(path), path.endsWith('/佳明快照.json') ? '来源与质量.json' : path.split('/').at(-1)!.replace('快照', '来源与质量'))
      const qBytes = await readMaybe(await safePath(this.root, qPath)); let quality: unknown = {}
      if (qBytes) { try { quality = JSON.parse(qBytes.toString()) } catch { failures.push('质量文件无法解析：' + qPath) } }
      snapshots.push({ path, value, quality, hash: hashBytes(bytes), stamp: String(object(s.collection_window).completed_at ?? s.recorded_at ?? s.archive_date ?? path) })
    } catch { failures.push('快照无法读取或解析：' + path) } }
    snapshots.sort((a, b) => a.stamp.localeCompare(b.stamp))
    let overview = normalizeSnapshot({}, {}, { date, path: '', now: this.now() })
    const activities = new Map<string, GarminActivity>(), workouts = new Map<string, GarminOverview['workouts'][number]>()
    const historyPath = '运动/活动记录.md', history = await readMaybe(await safePath(this.root, historyPath))
    if (history) for (const a of markdownActivities(history.toString(), historyPath)) activities.set(a.id, a)
    for (const entry of snapshots) {
      const next = normalizeSnapshot(entry.value, entry.quality, { date, path: entry.path, now: this.now(), hash: entry.hash })
      for (const key of Object.keys(next.metrics) as (keyof GarminOverview['metrics'])[]) if (next.metrics[key].value === null && overview.metrics[key].value !== null) { next.metrics[key] = { ...overview.metrics[key], stale: true }; next.quality.push('最新快照缺少该指标，沿用旧有效来源：' + key) }
      for (const a of next.activities) activities.set(a.id, a)
      for (const w of next.workouts) workouts.set(w.id, w)
      if (!next.lastSuccessAt) next.lastSuccessAt = overview.lastSuccessAt
      next.sources = [...overview.sources, ...next.sources]; overview = next
    }
    overview.activities = [...activities.values()].sort((a, b) => b.startTime.localeCompare(a.startTime))
    overview.workouts = [...workouts.values()].sort((a, b) => a.date.localeCompare(b.date))
    overview.quality.push(...failures); if (failures.length && overview.status !== 'failed') overview.status = 'partial'
    return overview
  }
  async readActivities(range: { from?: string; through?: string } = {}) { const r = await this.readOverview(range.through ?? '9999-12-31'); return r.activities.filter(a => (!range.from || a.date >= range.from) && (!range.through || a.date <= range.through)) }
  async readTrainingPlan(date: string) { return (await this.readOverview(date)).workouts.filter(w => w.date === date) }
}
