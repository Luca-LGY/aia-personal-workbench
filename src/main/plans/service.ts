import { z } from 'zod'
import { makeRecord, type RecordEnvelope } from '../../shared/schemas'
import { ScheduleSchema, type ScheduleInput, type PlanStatus } from '../../shared/plans'
import type { ArchiveRepository } from '../archive/repository'
import type { SaveRecord } from '../../shared/models'
import { RecordSchema } from '../../shared/schemas'
export class PlanService {
  constructor(private repo: ArchiveRepository, private resolveSource?: (id: string) => Promise<RecordEnvelope | null>) {}
  async schedule(input: ScheduleInput) {
    const p = ScheduleSchema.parse(input)
    const source = p.sourceId ? await this.repo.get(p.sourceId) ?? await this.resolveSource?.(p.sourceId) : null
    if (p.sourceId && !source) throw Error('来源已不存在，请建立独立计划')
    if (p.sourceId) { const prior = (await this.listDay(p.date)).find(r => r.data.sourceId === p.sourceId && r.data.status !== 'cancelled'); if (prior) return prior }
    const record = makeRecord('plan', { title: p.title ?? source?.title ?? '今日安排', date: p.date, module: source?.module ?? 'inbox', sourceRefs: p.sourceId ? [{ recordId: p.sourceId }] : [], data: { sourceId: p.sourceId ?? null, scheduledDate: p.date, ...(p.time ? { time: p.time } : {}), priority: p.priority ?? 'normal', status: 'pending' } })
    await this.repo.save({ record, expectedHash: null }); return record
  }
  async listDay(date: string) { z.iso.date().parse(date); return (await this.repo.list({ kind: 'plan' })).filter(r => r.data.scheduledDate === date).sort((a, b) => String(a.data.time ?? '99:99').localeCompare(String(b.data.time ?? '99:99'))) }
  private async version(id: string, hash: string) { const v = await this.repo.version(id); if (!v || v.hash !== hash) throw Error('CONFLICT: 计划已变化，请刷新'); if (v.record.kind !== 'plan') throw Error('不是计划记录'); return { ...v, record: v.record } }
  async setStatus(id: string, status: PlanStatus, hash: string) { z.enum(['pending', 'done', 'cancelled']).parse(status); const v = await this.version(id, hash); return this.repo.save({ record: { ...v.record, updatedAt: new Date().toISOString(), data: { ...v.record.data, status } }, expectedHash: hash }) }
  async reschedule(id: string, date: string, hash: string) { z.iso.date().parse(date); const v = await this.version(id, hash); return this.repo.save({ record: { ...v.record, date, updatedAt: new Date().toISOString(), data: { ...v.record.data, scheduledDate: date } }, expectedHash: hash }) }
  async update(input: SaveRecord) {
    const r = RecordSchema.parse(input.record)
    if (r.kind !== 'plan' || !input.expectedHash) throw Error('请选择已有计划')
    const prior = await this.version(r.id, input.expectedHash)
    if (r.data.sourceId !== prior.record.data.sourceId) throw Error('计划来源不能修改')
    ScheduleSchema.parse({ date: r.date, time: r.data.time || undefined, priority: r.data.priority })
    return this.repo.save({ ...input, record: { ...r, data: { ...r.data, scheduledDate: r.date } } })
  }
}
