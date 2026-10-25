import { test, expect } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import daily from '../fixtures/garmin/daily.json'
import { ArchiveRepository } from '../../src/main/archive/repository'
import { GarminArchiveReader } from '../../src/main/garmin/reader'
import { TrainingAdviceService } from '../../src/main/reports/training'
async function setup() { const dir = await mkdtemp(join(tmpdir(), 'aia-adopt-')), root = join(dir, 'archive'), state = join(dir, 'state'), folder = join(root, '运动/数据/2026-10-25'); await mkdir(folder, { recursive: true }); const file = join(folder, '佳明快照.json'); await writeFile(file, JSON.stringify(daily)); const repo = new ArchiveRepository(root, state); await repo.open(); return { repo, file, service: new TrainingAdviceService(repo, new GarminArchiveReader(root)), close: () => rm(dir, { recursive: true, force: true }) } }
test('repeated adoption is idempotent, custom reschedules the same plan and skip cancels it with a reason', async () => {
  const t = await setup(); try {
    const choices = await t.service.propose('2026-10-25'), original = choices.find(c => c.action === 'original')!, custom = choices.find(c => c.action === 'custom')!, skip = choices.find(c => c.action === 'skip')!
    const a = await t.service.adopt({ proposalId: original.id, date: original.date })
    expect(await t.service.adopt({ proposalId: original.id, date: original.date })).toEqual(a)
    const b = await t.service.adopt({ proposalId: custom.id, date: custom.date, targetDate: '2026-10-26', time: '13:30' })
    expect(b.planId).toBe(a.planId)
    expect((await t.repo.get(a.planId!))?.data).toMatchObject({ scheduledDate: '2026-10-26', time: '13:30', status: 'pending' })
    await expect(t.service.adopt({ proposalId: skip.id, date: skip.date })).rejects.toThrow('原因')
    await t.service.adopt({ proposalId: skip.id, date: skip.date, reason: '今天另有安排' })
    expect((await t.repo.list({ kind: 'plan' })).filter(p => p.data.status === 'pending')).toHaveLength(0)
    expect((await t.repo.list({ kind: 'advice' })).some(r => r.body === '今天另有安排')).toBe(true)
  } finally { await t.close() }
})
test('changed source invalidates the preview and does not create a plan', async () => {
  const t = await setup(); try {
    const [choice] = await t.service.propose('2026-10-25')
    await writeFile(t.file, JSON.stringify({ ...daily, quality_flags: ['来源已更新'] }))
    await expect(t.service.adopt({ proposalId: choice.id, date: choice.date })).rejects.toThrow('来源已变化')
    expect(await t.repo.list()).toHaveLength(0)
  } finally { await t.close() }
})
