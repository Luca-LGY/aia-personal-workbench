import { z } from 'zod'
import { makeRecord, type RecordEnvelope } from '../../shared/schemas'
import type { GarminActivity } from '../../shared/garmin'
import type { SourceRef } from '../../shared/models'
import type { WeeklySummary } from '../../shared/reports'
import type { ArchiveRepository } from '../archive/repository'
import type { GarminArchiveReader } from '../garmin/reader'
import type { SearchService } from '../indexing/search'
export function weekBounds(date: string) { z.iso.date().parse(date); const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); const start = d.toISOString().slice(0, 10); d.setUTCDate(d.getUTCDate() + 6); return { start, end: d.toISOString().slice(0, 10) } }
export function summarizeWeek(records: RecordEnvelope[], activities: GarminActivity[], date: string): WeeklySummary {
  const { start, end } = weekBounds(date), inWeek = (day: string) => day >= start && day <= end
  const unique = [...new Map(records.map(r => [r.id, r])).values()], garmin = [...new Map(activities.filter(a => inWeek(a.date)).map(a => [a.id, a])).values()], ids = new Set(garmin.map(a => a.id))
  const facts = unique.filter(r => inWeek(r.date) && r.role === 'actual' && ['note', 'experiment', 'activity', 'meal', 'play_session', 'dev_version'].includes(r.kind) && !(r.kind === 'meal' && r.data.consumed === false) && !(r.kind === 'activity' && typeof r.data.garminId === 'string' && ids.has(r.data.garminId)))
  const plans = unique.filter(r => r.kind === 'plan' && inWeek(String(r.data.scheduledDate)) && r.data.status !== 'cancelled')
  const manual = facts.filter(r => r.kind === 'activity'), durations = [...manual.map(r => r.data.durationMin), ...garmin.map(a => a.durationMin)]
  const known = durations.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0), byModule: Record<string, number> = {}
  for (const r of facts) byModule[r.module] = (byModule[r.module] ?? 0) + 1
  if (garmin.length) byModule.sports = (byModule.sports ?? 0) + garmin.length
  const sources: SourceRef[] = [...facts, ...plans].map(r => ({ recordId: r.id, heading: r.title }))
  for (const a of garmin) sources.push({ ...a.source, heading: '活动 ID ' + a.id })
  return { start, end, actualCount: facts.length + garmin.length, byModule, coveredDates: [...new Set([...facts.map(r => r.date), ...garmin.map(a => a.date)])].sort(), knownSportMinutes: known.length ? known.reduce((a, b) => a + b, 0) : null, unknownSportDurationCount: durations.length - known.length, sportCount: durations.length, plans: { total: plans.length, done: plans.filter(r => r.data.status === 'done').length, pending: plans.filter(r => r.data.status === 'pending').length }, sources }
}
export class WeeklyReportService {
  constructor(private repo: ArchiveRepository, private garmin: GarminArchiveReader, private search: SearchService, private now: () => Date = () => new Date()) {}
  async read(date: string) {
    const range = weekBounds(date), [views, activities] = await Promise.all([this.search.list(), this.garmin.readActivities({ from: range.start, through: range.end })])
    const summary = summarizeWeek(views.map(v => v.record), activities, date), map = new Map(views.map(v => [v.record.id, v]))
    summary.sources = summary.sources.map(s => { const v = s.recordId ? map.get(s.recordId) : null; return v ? { ...s, path: v.path, hash: v.hash } : s })
    return summary
  }
  async build(date: string) {
    const summary = await this.read(date), prior = (await this.repo.list({ kind: 'report' })).find(r => r.data.generatedBy === 'basic-rules-v1' && r.data.weekStart === summary.start)
    const { sources, ...metrics } = summary
    const body = [`自然周：${summary.start} 至 ${summary.end}（Asia/Shanghai，周一至周日）`, `实际记录：${summary.actualCount} 条。记录数不代表掌握程度、实验成功或完整生活记录。`, `计划：${summary.plans.done}/${summary.plans.total} 已完成，${summary.plans.pending} 待处理。`, `已知运动时长：${summary.knownSportMinutes === null ? '未记录' : summary.knownSportMinutes + ' 分钟'}；${summary.unknownSportDurationCount} 条运动时长未知。`, `有记录日期：${summary.coveredDates.join('、') || '暂无'}（${summary.coveredDates.length}/7 天）。无记录不等于没有活动。`, '统计排除模板、参考资料、未来计划、未吃的饮食记录；按记录ID及佳明活动ID去重。', '本报告为有来源的基础规则汇总。'].join('\n\n')
    const record = makeRecord('report', { ...(prior ?? {}), title: '本周周报 · ' + summary.start, module: 'inbox', body, updatedAt: this.now().toISOString(), sourceRefs: sources, data: { ...metrics, weekStart: summary.start, weekEnd: summary.end, generatedBy: 'basic-rules-v1' } }, this.now())
    await this.repo.save({ record, expectedHash: prior ? (await this.repo.version(prior.id))!.hash : null }); return record
  }
}
