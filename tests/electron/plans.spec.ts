import { test, expect } from '@playwright/test'
import { launchTestApp } from '../helpers/electron-app'
test('daily plans add, finish, undo, defer and persist while home uses the same plan', async () => {
  const t = await launchTestApp(); let next: Awaited<ReturnType<typeof launchTestApp>> | undefined
  try {
    await t.page.getByRole('navigation').getByRole('button', { name: '今日计划', exact: true }).click()
    await t.page.getByLabel('计划内容').fill('整理今天的材料')
    await t.page.getByLabel('计划时间').fill('09:30')
    await t.page.getByLabel('计划优先级').selectOption('high')
    await t.page.getByRole('button', { name: '添加计划', exact: true }).click()
    await t.page.getByRole('button', { name: '完成计划：整理今天的材料' }).click()
    await t.page.getByRole('navigation').getByRole('button', { name: '首页总览', exact: true }).click()
    await expect(t.page.getByRole('button', { name: '撤销完成：整理今天的材料' })).toBeVisible()
    await t.page.getByRole('button', { name: '撤销完成：整理今天的材料' }).click()
    await t.page.getByRole('navigation').getByRole('button', { name: '今日计划', exact: true }).click()
    await t.page.getByLabel('调整日期：整理今天的材料').fill('2026-10-26')
    await t.page.getByRole('button', { name: '延期：整理今天的材料' }).click()
    await expect(t.page.getByRole('button', { name: '完成计划：整理今天的材料' })).toHaveCount(0)
    await t.app.close(); next = await launchTestApp({ archiveRoot: t.archiveRoot, stateRoot: t.stateRoot })
    const plans = await next.page.evaluate(() => window.aia.records.list({ kind: 'plan' }))
    expect(plans).toHaveLength(1); expect(plans[0].record.data).toMatchObject({ scheduledDate: '2026-10-26', status: 'pending', time: '09:30', priority: 'high' })
    await next.page.getByRole('navigation').getByRole('button', { name: '今日计划', exact: true }).click()
    await next.page.getByLabel('查看日期').fill('2026-10-26')
    await expect(next.page.getByRole('button', { name: '完成计划：整理今天的材料' })).toBeVisible()
  } finally { await next?.close(); await t.close() }
})
