import { test, expect } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ArchiveRepository } from '../../src/main/archive/repository'
import { CaptureService } from '../../src/main/capture/service'
async function setup() { const dir = await mkdtemp(join(tmpdir(), 'aia-capture-')); const repo = new ArchiveRepository(join(dir, 'archive'), join(dir, 'state')); await repo.open(); return { repo, service: new CaptureService(repo, () => new Date('2026-10-25T10:00:00+08:00')), close: () => rm(dir, { recursive: true, force: true }) } }
test('durable idempotent receipt survives retry and changed payload is rejected', async () => {
  const t = await setup(); try {
    const p = await t.service.preview('今天早餐吃了鸡蛋；明天跑步30分钟', [])
    const first = await t.service.commit(p), second = await new CaptureService(t.repo).commit(p)
    expect(first).toEqual(second); expect(await t.repo.list({ kind: 'raw_input' })).toHaveLength(1)
    expect(await t.repo.list({ kind: 'plan' })).toHaveLength(1)
    expect((await t.repo.list()).length).toBe(4)
    await expect(t.service.commit({ ...p, rawText: '不同的原话' })).rejects.toThrow('CAPTURE_ID_REUSED')
    await t.service.undo(p.sourceId)
    expect(await t.repo.list()).toHaveLength(0)
    await expect(t.service.commit(p)).rejects.toThrow('CAPTURE_UNDONE')
  } finally { await t.close() }
})
test('undo refuses the whole group if any derived record was edited', async () => {
  const t = await setup(); try {
    const p = await t.service.preview('今天早餐吃了鸡蛋；昨天跑了30分钟', []); await t.service.commit(p)
    const v = (await t.repo.version(p.entries[0].record.id))!
    await t.repo.save({ record: { ...v.record, title: '后来的修改' }, expectedHash: v.hash })
    await expect(t.service.undo(p.sourceId)).rejects.toThrow('CONFLICT')
    expect(await t.repo.list()).toHaveLength(3)
    expect((await t.repo.get(v.record.id))?.title).toBe('后来的修改')
  } finally { await t.close() }
})
test('invalid source ranges cannot be saved and no partial group appears', async () => {
  const t = await setup(); try {
    const p = await t.service.preview('今天早餐吃了鸡蛋', []); p.entries[0].end = 999
    await expect(t.service.commit(p)).rejects.toThrow('SOURCE_RANGE')
    expect(await t.repo.list()).toHaveLength(0)
  } finally { await t.close() }
})
test('interrupted capture recovers receipt and retry does not create more records', async () => {
  const t = await setup(); try {
    const p = await t.service.preview('明天跑步30分钟', [])
    const failing = new ArchiveRepository(t.repo.root, t.repo.stateRoot, { onStage: s => { if (s === 'prepared') throw Error('SIMULATED_CRASH') } })
    await failing.open()
    await expect(new CaptureService(failing).commit(p)).rejects.toThrow('SIMULATED_CRASH')
    const reopened = new ArchiveRepository(t.repo.root, t.repo.stateRoot); await reopened.open()
    const receipt = await new CaptureService(reopened).commit(p)
    expect(await reopened.list()).toHaveLength(3)
    expect(receipt.recordIds).toHaveLength(3)
  } finally { await t.close() }
})
