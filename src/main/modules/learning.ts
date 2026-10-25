import type { SaveRecord } from '../../shared/models'
import { RecordSchema } from '../../shared/schemas'
import type { ArchiveRepository } from '../archive/repository'
export class LearningService {
  constructor(private repo: ArchiveRepository) {}
  listSubjects() { return this.repo.list({ kind: 'subject', module: 'learning' }) }
  async getSubject(id: string) { const subject = await this.repo.get(id); if (subject?.kind !== 'subject') return null; return { subject, notes: (await this.repo.list({ kind: 'note', module: 'learning' })).filter(r => r.data.subjectId === id) } }
  async saveSubject(input: SaveRecord) { const r = RecordSchema.parse(input.record); if (r.kind !== 'subject' || r.module !== 'learning') throw Error('科目类型不正确'); return this.repo.save({ ...input, record: r }) }
  async saveNote(input: SaveRecord) {
    const r = RecordSchema.parse(input.record); if (r.kind !== 'note' || r.module !== 'learning') throw Error('学习笔记类型不正确')
    if (r.data.subjectId && (await this.repo.get(r.data.subjectId))?.kind !== 'subject') throw Error('所属科目不存在')
    return this.repo.save({ ...input, record: r })
  }
}
