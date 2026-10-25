import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { GarminOverview } from '../../shared/garmin'
import type { AdvicePreview, AdoptAdvice } from '../../shared/reports'
import { makeRecord } from '../../shared/schemas'
import type { SaveRecord } from '../../shared/models'
import type { ArchiveRepository } from '../archive/repository'
import type { GarminArchiveReader } from '../garmin/reader'
function digest(value: string) { return createHash('sha256').update(value).digest('hex') }
export function proposeTraining(o: GarminOverview, date: string): AdvicePreview[] {
  const result: AdvicePreview[] = [], limitations = ['安排仅依据已归档课程与设备执行状态；未读取到的实际执行不作推断']
  if (o.metrics.readiness.stale || o.metrics.readiness.value === null) limitations.push('准备度日期较旧，不据此推算训练强度')
  for (const workout of o.workouts.filter(w => w.date === date)) for (const action of ['original', 'skip', 'custom'] as const) result.push({ id: digest(workout.id + date + action + (workout.source.hash ?? '')), date, originalDate: workout.date, workoutId: workout.id, name: workout.name, action, basis: ['课程实际日期：' + workout.date, '原名称：' + workout.name, '设备执行状态：' + (workout.completed === null ? '未知' : workout.completed ? '已完成' : '未完成')], limitations: [...limitations], source: workout.source })
  const pending = o.workouts.filter(w => w.date < date && !w.rest && w.completed === false).sort((a, b) => b.date.localeCompare(a.date))[0]
  if (pending && (Date.parse(date) - Date.parse(pending.date)) / 86400000 <= 7) result.push({ id: digest(pending.id + date + 'defer' + (pending.source.hash ?? '')), date, originalDate: pending.date, workoutId: pending.id, name: pending.name, action: 'defer', basis: ['原课程日期：' + pending.date, '设备明确标记未完成；可选择顺延，实际未记录的部分仍未知'], limitations: [...limitations], source: pending.source })
  return result
}
export const AdoptAdviceSchema = z.object({ proposalId: z.string().regex(/^[a-f0-9]{64}$/), date: z.iso.date(), targetDate: z.iso.date().optional(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), reason: z.string().optional() })
export class TrainingAdviceService {
  private tail: Promise<unknown> = Promise.resolve()
  constructor(private repo: ArchiveRepository, private garmin: GarminArchiveReader) {}
  async propose(date: string) { return proposeTraining(await this.garmin.readOverview(date), date) }
  adopt(input: AdoptAdvice) { const work = this.tail.then(() => this.adoptOnce(input)); this.tail = work.catch(() => {}); return work }
  private async adoptOnce(input: AdoptAdvice) {
    const p = AdoptAdviceSchema.parse(input), choice = (await this.propose(p.date)).find(a => a.id === p.proposalId)
    if (!choice) throw Error('安排来源已变化，请重新查看')
    if (choice.action === 'skip' && !p.reason?.trim()) throw Error('请填写跳过原因')
    if (choice.action === 'custom' && (!p.targetDate || !p.time)) throw Error('请指定安排日期与时间')
    const related = (await this.repo.list({ kind: 'advice' })).filter(r => r.data.workoutId === choice.workoutId && r.data.adopted === true), plans = await this.repo.list({ kind: 'plan' })
    const prior = related.find(r => r.data.proposalId === choice.id && r.data.active !== false)
    if (prior) return { adviceId: prior.id, planId: plans.find(r => r.data.sourceId === prior.id && r.data.status !== 'cancelled')?.id ?? null }
    const relatedIds = new Set(related.map(r => r.id)), pending = plans.filter(r => relatedIds.has(String(r.data.sourceId)) && r.data.status === 'pending'), updates: SaveRecord[] = []
    for (const old of related.filter(r => r.data.active !== false)) { const v = (await this.repo.version(old.id))!; updates.push({ record: makeRecord('advice', { ...v.record, updatedAt: new Date().toISOString(), data: { ...v.record.data, active: false } }), expectedHash: v.hash }) }
    const advice = makeRecord('advice', { title: choice.name + ' · ' + ({ original: '采用原计划', defer: '顺延', skip: '跳过', custom: '指定时段' }[choice.action]), module: 'sports', body: p.reason ?? '', sourceRefs: [choice.source], data: { proposalId: choice.id, workoutId: choice.workoutId, originalDate: choice.originalDate, action: choice.action, basis: choice.basis, limitations: choice.limitations, adopted: true, active: true } })
    updates.push({ record: advice, expectedHash: null })
    const existing = pending[0] ? await this.repo.version(pending[0].id) : null
    if (existing && (existing.record.kind !== 'plan' || existing.record.data.status !== 'pending')) throw Error('CONFLICT: 现有计划已变化')
    const targetDate = choice.action === 'custom' ? p.targetDate! : p.date
    const plan = choice.action === 'skip' ? null : makeRecord('plan', { ...(existing?.record ?? {}), title: choice.name, module: 'sports', date: targetDate, updatedAt: new Date().toISOString(), sourceRefs: [{ recordId: advice.id }], data: { ...(existing?.record.data ?? {}), sourceId: advice.id, scheduledDate: targetDate, time: choice.action === 'custom' ? p.time : undefined, priority: existing?.record.data.priority ?? 'normal', status: 'pending' } })
    if (plan) updates.push({ record: plan, expectedHash: existing?.hash ?? null })
    for (const old of pending.filter(r => !plan || r.id !== plan.id)) { const v = (await this.repo.version(old.id))!; if (v.record.kind !== 'plan' || v.record.data.status !== 'pending') throw Error('CONFLICT: 现有计划已变化'); updates.push({ record: { ...v.record, updatedAt: new Date().toISOString(), data: { ...v.record.data, status: 'cancelled' } }, expectedHash: v.hash }) }
    await this.repo.saveMany(updates)
    return { adviceId: advice.id, planId: plan?.id ?? null }
  }
}
