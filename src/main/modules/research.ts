import type { SaveRecord } from '../../shared/models'
import { RecordSchema } from '../../shared/schemas'
import type { ArchiveRepository } from '../archive/repository'
export class ResearchService {
  constructor(private repo: ArchiveRepository) {}
  listProjects() { return this.repo.list({ kind: 'research_project', module: 'research' }) }
  async getProject(id: string) { const project = await this.repo.get(id); if (project?.kind !== 'research_project') return null; return { project, experiments: (await this.repo.list({ kind: 'experiment', module: 'research' })).filter(r => r.data.projectId === id && r.role === 'actual') } }
  async saveProject(input: SaveRecord) { const r = RecordSchema.parse(input.record); if (r.kind !== 'research_project' || r.module !== 'research') throw Error('课题类型不正确'); return this.repo.save({ ...input, record: r }) }
  async saveExperiment(input: SaveRecord) {
    const r = RecordSchema.parse(input.record); if (r.kind !== 'experiment' || r.module !== 'research') throw Error('实验类型不正确')
    if (!r.data.projectId || (await this.repo.get(r.data.projectId))?.kind !== 'research_project') throw Error('请先选择所属课题')
    const existing = await this.repo.get(r.id)
    if (existing?.kind === 'experiment' && existing.data.experimentNo !== r.data.experimentNo) throw Error('固定编号不能修改，请更改标题')
    const duplicate = (await this.repo.list({ kind: 'experiment' })).some(v => v.id !== r.id && v.data.projectId === r.data.projectId && String(v.data.experimentNo).trim().toLowerCase() === r.data.experimentNo.trim().toLowerCase())
    if (duplicate) throw Error('该课题已存在同编号实验')
    return this.repo.save({ ...input, record: r })
  }
}
