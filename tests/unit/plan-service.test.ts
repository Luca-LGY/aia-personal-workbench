import { test, expect } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ArchiveRepository } from '../../src/main/archive/repository'
import { PlanService } from '../../src/main/plans/service'
import { makeRecord } from '../../src/shared/schemas'
async function setup() { const dir = await mkdtemp(join(tmpdir(), 'aia-plan-')); const repo = new ArchiveRepository(join(dir, 'archive'), join(dir, 'state')); await repo.open(); return { repo, service: new PlanService(repo), close: () => rm(dir, { recursive: true, force: true }) } }
test('schedule, complete, undo and reschedule share a stable identity without changing source', async () => {
  const t = await setup(); try {
    const source = makeRecord('experiment', { title: '实验下一步', module: 'research', data: { experimentNo: 'E-01', status: 'running', result: '' } })
    await t.repo.save({ record: source, expectedHash: null }); const original = await t.repo.version(source.id)
    const p = await t.service.schedule({ sourceId: source.id, date: '2026-10-25', time: '14:30', priority: 'high' })
    const again = await t.service.schedule({ sourceId: source.id, date: '2026-10-25' }); expect(again.id).toBe(p.id)
    await t.service.setStatus(p.id, 'done', (await t.repo.version(p.id))!.hash)
    expect((await t.service.listDay('2026-10-25'))[0].data.status).toBe('done')
    expect((await t.repo.version(source.id))!.hash).toBe(original!.hash)
    await t.service.setStatus(p.id, 'pending', (await t.repo.version(p.id))!.hash)
    await t.service.reschedule(p.id, '2026-10-26', (await t.repo.version(p.id))!.hash)
    expect(await t.service.listDay('2026-10-25')).toHaveLength(0)
    expect((await t.service.listDay('2026-10-26'))[0]).toMatchObject({ id: p.id, date: '2026-10-26', data: { scheduledDate: '2026-10-26', sourceId: source.id } })
    await t.repo.remove(source.id, original!.hash)
    expect((await t.service.listDay('2026-10-26'))[0].id).toBe(p.id)
    await expect(t.service.setStatus(p.id, 'done', original!.hash)).rejects.toThrow('CONFLICT')
  } finally { await t.close() }
})
test('independent task is valid, invalid dates and times never persist', async () => {
  const t = await setup(); try {
    const p = await t.service.schedule({ title: '独立待办', date: '2026-10-25' }); expect(p.data.sourceId).toBeNull()
    await expect(t.service.schedule({ title: '坏时间', date: '2026-02-30', time: '27:90' })).rejects.toThrow()
    expect(await t.repo.list()).toHaveLength(1)
  } finally { await t.close() }
})
