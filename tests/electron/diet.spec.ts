import { test, expect } from '@playwright/test'
import { launchTestApp } from '../helpers/electron-app'
test('meal facts and future plans use the captured identity, allow edits, and survive restart without invented nutrition', async () => {
  const t = await launchTestApp(); let next: Awaited<ReturnType<typeof launchTestApp>> | undefined
  try {
    const receipt = await t.page.evaluate(async () => window.aia.capture.commit(await window.aia.capture.preview('今天早餐吃了鸡蛋', [])))
    const [captured] = await t.page.evaluate(() => window.aia.records.list({ kind: 'meal' }))
    await t.page.getByRole('navigation').getByRole('button', { name: '饮食计划', exact: true }).click()
    await expect(t.page.getByLabel('饮食日期')).toBeVisible()
    const fact = t.page.getByRole('article', { name: '饮食：' + captured.record.id })
    await expect(fact).toContainText('数量未记录')
    await fact.getByRole('button', { name: '编辑饮食', exact: true }).click()
    await t.page.getByLabel('餐次').selectOption('lunch')
    await t.page.getByLabel('饮食描述').fill('鸡蛋和面包')
    await t.page.getByRole('button', { name: '保存饮食', exact: true }).click()
    await expect(fact).toContainText('午餐')
    await expect(fact).toContainText('鸡蛋和面包')
    await t.page.getByLabel('饮食日期').fill('2026-10-26')
    await t.page.getByLabel('饮食性质').selectOption('plan')
    await t.page.getByLabel('餐次').selectOption('breakfast')
    await t.page.getByLabel('饮食描述').fill('明天的早餐安排')
    await t.page.getByRole('button', { name: '保存饮食', exact: true }).click()
    await expect(t.page.getByRole('status',{name:'操作提示'})).toContainText('饮食已保存')
    await expect(t.page.getByRole('article').filter({ hasText: '明天的早餐安排' })).toBeVisible()
    await expect(t.page.getByText('计划饮食', { exact: true })).toBeVisible()
    await expect(t.page.getByText(/热量|卡路里|千卡/)).toHaveCount(0)
    await t.app.close(); next = await launchTestApp({ archiveRoot: t.archiveRoot, stateRoot: t.stateRoot })
    const meals = await next.page.evaluate(() => window.aia.records.list({ kind: 'meal' }))
    expect(meals).toHaveLength(2)
    const actual = meals.find(v => v.record.id === captured.record.id)!
    expect(actual.record.data).toMatchObject({ meal: 'lunch', description: '鸡蛋和面包', quantity: null })
    expect(actual.record.sourceRefs[0].recordId).toBe(receipt.sourceId)
    const plans = await next.page.evaluate(() => window.aia.plans.listDay('2026-10-26'))
    expect(plans).toHaveLength(1)
    expect(plans[0].data.sourceId).toBe(meals.find(v => v.record.role === 'plan')!.record.id)
  } finally { await next?.close(); await t.close() }
})
