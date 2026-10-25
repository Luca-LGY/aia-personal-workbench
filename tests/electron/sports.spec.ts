import { test, expect } from '@playwright/test'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { launchTestApp } from '../helpers/electron-app'
import daily from '../fixtures/garmin/daily.json' with { type: 'json' }
test('sports reads dated Garmin archives, retains full history and shows the same source dates on home', async () => {
  const t = await launchTestApp(); try {
    const dir = join(t.archiveRoot, '运动/数据/2026-10-25'); await mkdir(dir, { recursive: true })
    const snapshot = JSON.stringify(daily); await writeFile(join(dir, '佳明快照.json'), snapshot)
    await writeFile(join(t.archiveRoot, '运动/活动记录.md'), '| 当地日期时间 | 类型 | 活动名 | km | 分钟 | 活动 ID |\n| --- | --- | --- | --- | --- | --- |\n| 2026-09-01 07:00 | running | 历史合成跑步 | 3 | 20 | 8000 |\n')
    await t.page.getByRole('navigation').getByRole('button', { name: '运动计划', exact: true }).click()
    await expect(t.page.getByLabel('运动查看日期')).toBeVisible()
    await expect(t.page.getByText('1234 步', { exact: true })).toBeVisible()
    await expect(t.page.getByText('2026-10-24 · 旧值', { exact: true }).first()).toBeVisible()
    await expect(t.page.getByText('合成轻松跑', { exact: true })).toBeVisible()
    await expect(t.page.getByRole('button', { name: '运动详情：历史合成跑步' })).toBeVisible()
    await t.page.getByRole('button', { name: '运动详情：合成晨跑' }).click()
    await expect(t.page.getByRole('dialog', { name: '合成晨跑' })).toContainText('30 分钟')
    await t.page.getByRole('button', { name: '关闭运动详情' }).click()
    await t.page.getByRole('navigation').getByRole('button', { name: '首页总览', exact: true }).click()
    const summary = t.page.getByRole('region', { name: '佳明今日' })
    await expect(summary).toContainText('2026-10-25')
    await expect(summary).toContainText('2026-10-24')
    await expect(t.page.getByRole('button', { name: /截图导入/ })).toHaveCount(0)
    expect(await readFile(join(dir, '佳明快照.json'), 'utf8')).toBe(snapshot)
  } finally { await t.close() }
})
