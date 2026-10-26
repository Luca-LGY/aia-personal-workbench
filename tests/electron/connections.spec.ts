import { test, expect } from '@playwright/test'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { launchTestApp } from '../helpers/electron-app'
import { fakeCloud } from '../helpers/fake-cloud'
test('connections encrypt real stored credentials, return only public state and survive restart independently', async () => {
  const cloud = await fakeCloud(), rejected = await fakeCloud({ unauthorized: true }), t = await launchTestApp(); let next: Awaited<ReturnType<typeof launchTestApp>> | undefined
  try {
    await t.page.getByRole('navigation').getByRole('button', { name: '数据与设置', exact: true }).click()
    await expect(t.page.getByLabel('坚果云WebDAV地址')).toBeVisible()
    await t.page.getByLabel('坚果云WebDAV地址').fill(cloud.url)
    await t.page.getByLabel('坚果云用户名').fill('synthetic-user')
    await t.page.getByLabel('坚果云应用密码').fill('TEST_ONLY_DAV_SECRET_63')
    await t.page.getByRole('button', { name: '保存坚果云连接', exact: true }).click()
    await expect(t.page.getByRole('status',{name:'操作提示'})).toContainText('坚果云连接已配置')
    await expect(t.page.getByLabel('坚果云应用密码')).toHaveValue('')
    await t.page.getByRole('button', { name: '测试坚果云连接', exact: true }).click()
    await expect(t.page.getByRole('region', { name: '坚果云连接' })).toContainText('验证成功，尚未同步')
    const visible = await t.page.evaluate(async () => ({ state: await window.aia.connections.getState(), exported: await window.aia.connections.export(), apiKeys: Object.keys(window.aia.connections) }))
    expect(JSON.stringify(visible)).not.toContain('TEST_ONLY_DAV_SECRET_63')
    expect(visible.apiKeys).not.toContain('getSecret')
    const cipherFiles = await readdir(join(t.stateRoot, 'credentials'))
    expect(cipherFiles).toContain('webdav.bin')
    expect((await readFile(join(t.stateRoot, 'credentials/webdav.bin'))).includes(Buffer.from('TEST_ONLY_DAV_SECRET_63'))).toBe(false)
    expect(await readFile(join(t.stateRoot, 'settings/connections.json'), 'utf8')).not.toContain('TEST_ONLY_DAV_SECRET_63')
    await t.page.getByLabel('GitHub所有者').fill('synthetic-owner')
    await t.page.getByLabel('GitHub档案仓库').fill('archive-only')
    await t.page.getByLabel('GitHub访问令牌').fill('TEST_ONLY_GITHUB_SECRET_71')
    await t.page.getByRole('button', { name: '保存GitHub连接', exact: true }).click()
    await expect(t.page.getByRole('status',{name:'操作提示'})).toContainText('GitHub连接已配置')
    await t.page.getByLabel('坚果云WebDAV地址').fill(rejected.url)
    await t.page.getByRole('button', { name: '保存坚果云连接', exact: true }).click()
    await expect(t.page.getByRole('status',{name:'操作提示'})).toContainText('坚果云连接已配置')
    await t.page.getByRole('button', { name: '测试坚果云连接', exact: true }).click()
    await expect(t.page.getByRole('region', { name: '坚果云连接' })).toContainText('验证失败')
    await t.page.getByLabel('启用坚果云同步').uncheck()
    await expect.poll(async () => (await t.page.evaluate(() => window.aia.connections.getState())).endpoints.webdav.enabled).toBe(false)
    await t.app.close(); next = await launchTestApp({ archiveRoot: t.archiveRoot, stateRoot: t.stateRoot })
    const state = await next.page.evaluate(() => window.aia.connections.getState())
    expect(state.endpoints.webdav.enabled).toBe(false); expect(state.endpoints.github.enabled).toBe(true)
    expect(state.endpoints.github.credentialStored).toBe(true)
    expect(JSON.stringify(await next.page.evaluate(() => window.aia.connections.export()))).not.toMatch(/TEST_ONLY|cipher|secret|token/i)
  } finally { await next?.close(); await t.close(); await cloud.close(); await rejected.close() }
})
