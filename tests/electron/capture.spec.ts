import { test, expect } from '@playwright/test'
import { launchTestApp } from '../helpers/electron-app'

test('capture edits classification, commits one identity, survives restart and can undo', async () => {
  const t = await launchTestApp()
  let reopened: Awaited<ReturnType<typeof launchTestApp>> | undefined
  try {
    await t.page.getByRole('textbox', { name: '随手记内容' }).fill('今天早餐吃了鸡蛋')
    await expect(t.page.getByLabel('事项1分类')).toHaveValue('diet')
    await t.page.getByLabel('事项1标题').fill('我的鸡蛋早餐')
    await t.page.getByRole('button', { name: '归档并同步', exact: true }).click()
    await expect(t.page.getByRole('status')).toContainText('已保存到本机')
    await expect(t.page.getByRole('status')).toContainText('云端待连接')
    const records = await t.page.evaluate(() => window.aia.records.list({ kind: 'meal' }))
    expect(records).toHaveLength(1)
    expect(records[0].record.title).toBe('我的鸡蛋早餐')
    const id = records[0].record.id
    const raw = await t.page.evaluate(() => window.aia.records.list({ kind: 'raw_input' }))
    expect(raw[0].record.body).toBe('今天早餐吃了鸡蛋')
    expect(records[0].record.sourceRefs[0].recordId).toBe(raw[0].record.id)
    await t.app.close()
    reopened = await launchTestApp({ archiveRoot: t.archiveRoot, stateRoot: t.stateRoot })
    expect((await reopened.page.evaluate(id => window.aia.records.get(id), id))?.record.id).toBe(id)
    const found = await reopened.page.evaluate(() => window.aia.search.query({ query: '我的鸡蛋早餐' }))
    expect(found.items[0].recordId).toBe(id)
    await reopened.page.evaluate(sourceId => window.aia.capture.undo(sourceId), raw[0].record.id)
    expect(await reopened.page.evaluate(id => window.aia.records.get(id), id)).toBeNull()
    await reopened.page.getByRole('textbox', { name: '随手记内容' }).fill('一段暂时无法分类的想法')
    await reopened.page.getByLabel('事项1分类').selectOption('research')
    await reopened.page.getByRole('button', { name: '归档并同步', exact: true }).click()
    await expect(reopened.page.getByRole('status')).toContainText('已保存到本机')
    const research = await reopened.page.evaluate(() => window.aia.records.list({ module: 'research' }))
    expect(research).toHaveLength(1)
    expect(research[0].record.body).toBe('一段暂时无法分类的想法')
  } finally { await reopened?.close(); await t.close() }
})
