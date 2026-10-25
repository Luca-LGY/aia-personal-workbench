import type { SaveRecord } from '../../shared/models'
import { RecordSchema } from '../../shared/schemas'
import type { ArchiveRepository } from '../archive/repository'
export function repositoryURL(value: string) { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw Error('仓库地址请填写不含令牌的 HTTPS 链接'); return url.href }
export class DevelopmentService {
  constructor(private repo: ArchiveRepository) {}
  async saveProject(input: SaveRecord) { const record = RecordSchema.parse(input.record); if (record.kind !== 'dev_project' || record.module !== 'development') throw Error('开发项目类型不正确'); if (record.data.repoUrl) repositoryURL(record.data.repoUrl); return this.repo.save({ ...input, record }) }
  async saveIssue(input: SaveRecord) { const record = RecordSchema.parse(input.record); if (record.kind !== 'dev_issue' || record.module !== 'development') throw Error('开发问题类型不正确'); await this.project(record.data.projectId); return this.repo.save({ ...input, record }) }
  async saveVersion(input: SaveRecord) { const record = RecordSchema.parse(input.record); if (record.kind !== 'dev_version' || record.module !== 'development' || !record.data.version.trim()) throw Error('版本记录类型不正确'); await this.project(record.data.projectId); return this.repo.save({ ...input, record }) }
  private async project(id: string) { const r = await this.repo.get(id); if (r?.kind !== 'dev_project') throw Error('所属开发项目不存在'); return r }
  async repoURL(id: string) { const r = await this.project(id); if (!r.data.repoUrl) throw Error('尚未关联项目仓库'); return repositoryURL(r.data.repoUrl) }
}
