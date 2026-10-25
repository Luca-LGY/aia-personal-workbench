import type { SaveRecord } from '../../shared/models'
import { RecordSchema } from '../../shared/schemas'
import type { ArchiveRepository } from '../archive/repository'
export class GamesService {
  constructor(private repo: ArchiveRepository) {}
  async saveGame(input: SaveRecord) { const record = RecordSchema.parse(input.record); if (record.kind !== 'game' || record.module !== 'games') throw Error('游戏类型不正确'); return this.repo.save({ ...input, record }) }
  async saveSession(input: SaveRecord) { const record = RecordSchema.parse(input.record); if (record.kind !== 'play_session' || record.module !== 'games' || record.role !== 'actual') throw Error('游玩记录类型不正确'); if ((await this.repo.get(record.data.gameId))?.kind !== 'game') throw Error('所属游戏不存在'); return this.repo.save({ ...input, record }) }
  async listSessions(gameId: string) { return (await this.repo.list({ kind: 'play_session', module: 'games', role: 'actual' })).filter(r => r.data.gameId === gameId) }
}
