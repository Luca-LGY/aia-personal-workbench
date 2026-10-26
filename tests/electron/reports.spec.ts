import { test, expect } from '@playwright/test'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { launchTestApp } from '../helpers/electron-app'
import { makeRecord } from '../../src/shared/schemas'
import daily from '../fixtures/garmin/daily.json' with { type: 'json' }
test('weekly summary saves traceable report and training plans require explicit adoption', async () => {
  const t = await launchTestApp(); try {
    const dir = join(t.archiveRoot, '运动/数据/2026-10-25'); await mkdir(dir, { recursive: true }); const bytes = JSON.stringify(daily); await writeFile(join(dir, '佳明快照.json'), bytes)
    const note = makeRecord('note', { title: '周报源笔记', module: 'learning', date: '2026-10-25', body: '本周完成的一次实际学习记录' })
    await t.page.evaluate(record => window.aia.records.save({ record, expectedHash: null }), note)
    await expect(t.page.getByRole('button', { name: '保存本周周报', exact: true })).toBeVisible()
    await expect(t.page.getByRole('region', { name: '本周回顾' })).toContainText('30 分钟')
    await t.page.getByRole('button', { name: '保存本周周报', exact: true }).click()
    await expect(t.page.getByRole('status',{name:'操作提示'})).toContainText('周报已保存')
    const [report] = await t.page.evaluate(() => window.aia.records.list({ kind: 'report' }))
    expect(report.record.sourceRefs.some(s => s.recordId === note.id)).toBe(true)
    await t.page.getByRole('button', { name: '查看本周报告', exact: true }).click()
    await t.page.getByRole('button', { name: '查看来源：周报源笔记', exact: true }).click()
    await expect(t.page.getByRole('dialog', { name: '周报源笔记' })).toBeVisible()
    await t.page.getByRole('button', { name: '关闭详情' }).click()
    expect(await t.page.evaluate(() => window.aia.records.list({ kind: 'plan' }))).toHaveLength(0)
    await t.page.getByRole('navigation').getByRole('button', { name: '运动计划', exact: true }).click()
    await expect(t.page.getByRole('button', { name: '采用原计划：合成轻松跑', exact: true })).toBeVisible()
    await t.page.getByRole('button', { name: '采用原计划：合成轻松跑', exact: true }).click()
    await expect(t.page.getByRole('status',{name:'操作提示'})).toContainText('已采用并加入计划')
    const plans = await t.page.evaluate(() => window.aia.plans.listDay('2026-10-25'))
    expect(plans).toHaveLength(1)
    const source = await t.page.evaluate(id => window.aia.records.get(id), plans[0].data.sourceId as string)
    expect(source?.record).toMatchObject({ kind: 'advice', role: 'suggestion', data: { adopted: true, action: 'original' } })
    expect(await readFile(join(dir, '佳明快照.json'), 'utf8')).toBe(bytes)
  } finally { await t.close() }
})
