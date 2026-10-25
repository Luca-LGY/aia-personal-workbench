import { join } from 'node:path'
import { CapturePreviewSchema, type CapturePreview, type CaptureReceipt } from '../../shared/capture'
import { makeRecord, type RecordEnvelope } from '../../shared/schemas'
import { hashBytes, serializeRecord } from '../archive/codec'
import { safePath } from '../archive/paths'
import { readMaybe } from '../archive/transactions'
import type { ArchiveRepository } from '../archive/repository'
import { previewCapture } from './parser'

export class CaptureService {
  private tail: Promise<unknown> = Promise.resolve()
  constructor(private repo: ArchiveRepository, private now: () => Date = () => new Date()) {}
  async preview(text: string, attachmentIds: string[]) {
    return previewCapture(text, { now: this.now(), subjects: await this.repo.list({ kind: 'subject' }), attachmentIds })
  }
  private path(id: string) { if (!/^[a-f0-9-]{36}$/.test(id)) throw Error('Invalid capture ID'); return join('.aia', 'captures', id + '.json') }
  private async receipt(id: string) { const raw = await readMaybe(await safePath(this.repo.root, this.path(id))); return raw ? { raw, value: JSON.parse(raw.toString()) as CaptureReceipt } : null }
  commit(input: CapturePreview): Promise<CaptureReceipt> {
    const work = this.tail.then(() => this.commitOnce(input)); this.tail = work.catch(() => {}); return work
  }
  private async commitOnce(input: CapturePreview) {
    const p = CapturePreviewSchema.parse(input), requestHash = hashBytes(JSON.stringify(p)), prior = await this.receipt(p.sourceId)
    if (prior) { if (prior.value.requestHash !== requestHash) throw Error('CAPTURE_ID_REUSED'); if (prior.value.status === 'undone') throw Error('CAPTURE_UNDONE'); return prior.value }
    const ids = new Set([p.sourceId]), records: RecordEnvelope[] = []
    for (const entry of p.entries) {
      if (entry.end > p.rawText.length || entry.end <= entry.start || p.rawText.slice(entry.start, entry.end) !== entry.record.body) throw Error('SOURCE_RANGE')
      if (ids.has(entry.record.id)) throw Error('Duplicate capture identity'); ids.add(entry.record.id)
      const ref = entry.record.sourceRefs.find(s => s.recordId === p.sourceId)
      if (!ref || ref.start !== entry.start || ref.end !== entry.end) throw Error('SOURCE_RANGE')
      const record = entry.record; records.push(record)
      if (record.role === 'plan' && record.kind !== 'plan') records.push(makeRecord('plan', { title: record.title, body: '', module: record.module, date: record.date, data: { sourceId: record.id, scheduledDate: record.date, priority: 'normal', status: 'pending' }, sourceRefs: [{ recordId: record.id }] }, new Date(p.createdAt)))
    }
    const raw = makeRecord('raw_input', { id: p.sourceId, title: '随手记原文', body: p.rawText, attachmentIds: p.attachmentIds, data: { captureIds: records.map(r => r.id) } }, new Date(p.createdAt))
    records.unshift(raw)
    const receipt: CaptureReceipt = { sourceId: p.sourceId, requestHash, status: 'committed', versions: records.map(r => ({ id: r.id, hash: hashBytes(serializeRecord(r)) })), recordIds: records.map(r => r.id), localState: 'saved', cloudState: 'not_connected' }
    await this.repo.saveMany(records.map(record => ({ record, expectedHash: null })), [{ path: this.path(p.sourceId), bytes: Buffer.from(JSON.stringify(receipt)), expectedHash: null }])
    return receipt
  }
  async undo(sourceId: string) {
    const prior = await this.receipt(sourceId); if (!prior) throw Error('Capture receipt missing')
    if (prior.value.status === 'undone') return
    await this.repo.removeMany(prior.value.versions, [{ path: this.path(sourceId), bytes: Buffer.from(JSON.stringify({ ...prior.value, status: 'undone' })), expectedHash: hashBytes(prior.raw) }])
  }
}
