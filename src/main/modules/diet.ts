import type { SaveRecord } from '../../shared/models'
import { makeRecord, RecordSchema } from '../../shared/schemas'
import type { ArchiveRepository } from '../archive/repository'
export class DietService {
  constructor(private repo: ArchiveRepository) {}
  listDay(date: string) { return this.repo.list({ kind: 'meal', module: 'diet', date }) }
  async saveMeal(input: SaveRecord) {
    const record = RecordSchema.parse(input.record); if (record.kind !== 'meal' || record.module !== 'diet' || !['actual', 'plan'].includes(record.role)) throw Error('饮食类型不正确')
    const inputs: SaveRecord[] = [{ ...input, record }]
    if (record.role === 'plan') {
      const prior = (await this.repo.list({ kind: 'plan' })).find(p => p.data.sourceId === record.id && p.data.status === 'pending')
      const plan = makeRecord('plan', { ...(prior ?? {}), title: record.title, module: 'diet', date: record.date, sourceRefs: [{ recordId: record.id }], updatedAt: new Date().toISOString(), data: { ...(prior?.data ?? {}), sourceId: record.id, scheduledDate: record.date, priority: prior?.data.priority ?? 'normal', status: 'pending' } })
      inputs.push({ record: plan, expectedHash: prior ? (await this.repo.version(prior.id))!.hash : null })
    }
    await this.repo.saveMany(inputs); return record
  }
}
