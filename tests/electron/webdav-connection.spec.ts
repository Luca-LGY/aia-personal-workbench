import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { launchTestApp } from '../helpers/electron-app'
import { fakeWebdav } from '../helpers/fake-webdav'
import { digest } from '../../src/main/sync/graph'
test('desktop settings inspect a complete WebDAV archive without importing or declaring it synchronized', async () => {
  const cloud = await fakeWebdav({ pageSize: 1 }), t = await launchTestApp(); try {
    cloud.seed('资料/测试 #.txt', 'synthetic cloud content'); cloud.seed('empty.bin', '')
    await t.page.getByRole('navigation').getByRole('button', { name: '数据与设置', exact: true }).click()
    await expect(t.page.getByRole('button', { name: '检查坚果云档案', exact: true })).toBeVisible()
    await t.page.getByLabel('坚果云WebDAV地址').fill(cloud.url); await t.page.getByLabel('坚果云用户名').fill('synthetic')
    await t.page.getByLabel('坚果云应用密码').fill('TEST_ONLY_DAV_INSPECTION')
    await t.page.getByRole('button', { name: '保存坚果云连接', exact: true }).click(); await expect(t.page.getByRole('status',{name:'操作提示'})).toContainText('坚果云连接已配置')
    await t.page.getByRole('button', { name: '测试坚果云连接', exact: true }).click()
    await expect(t.page.getByRole('region', { name: '坚果云连接' })).toContainText('验证成功，尚未同步')
    await t.page.getByRole('button', { name: '检查坚果云档案', exact: true }).click()
    await expect(t.page.getByText('云端列表完整：2 个文件', { exact: true })).toBeVisible()
    expect(await t.page.evaluate(() => window.aia.records.list())).toHaveLength(0)
    expect(await readFile(join(t.stateRoot, 'state/objects', digest('synthetic cloud content')), 'utf8')).toBe('synthetic cloud content')
    expect(cloud.files.get('/dav/资料/测试 #.txt')?.toString()).toBe('synthetic cloud content')
    await expect(t.page.getByText('已同步', { exact: true })).toHaveCount(0)
  } finally { await t.close(); await cloud.close() }
})
