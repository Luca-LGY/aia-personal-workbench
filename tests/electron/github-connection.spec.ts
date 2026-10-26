import { test,expect } from '@playwright/test'
import { fakeGithub } from '../helpers/fake-github'
import { launchTestApp } from '../helpers/electron-app'
test('GitHub connection verifies the selected archive branch and inspects complete bytes without publishing',async()=>{
 const server=await fakeGithub({truncateRecursive:true});server.edit('每日记录/学习数据/示例.md','测试来源');const t=await launchTestApp({githubAPI:server.url});try{
  await t.page.getByRole('navigation').getByRole('button',{name:'数据与设置',exact:true}).click();const card=t.page.getByRole('region',{name:'GitHub连接',exact:true})
  await card.getByLabel('GitHub所有者',{exact:true}).fill(server.owner);await card.getByLabel('GitHub档案仓库',{exact:true}).fill(server.repo);await card.getByLabel('GitHub访问令牌',{exact:true}).fill('SYNTHETIC_ONLY')
  await card.getByRole('button',{name:'保存GitHub连接',exact:true}).click();await expect(card.getByLabel('GitHub访问令牌',{exact:true})).toHaveValue('')
  await card.getByRole('button',{name:'测试GitHub连接',exact:true}).click();await expect(card).toContainText('验证成功')
  await card.getByRole('button',{name:'检查GitHub档案',exact:true}).click();await expect(card).toContainText('云端列表完整：1 个文件');expect(server.commitPosts).toBe(0)
  const state=await t.page.evaluate(()=>window.aia.connections.export());expect(JSON.stringify(state)).not.toContain('SYNTHETIC_ONLY');expect(server.requests.every(r=>r.version==='2026-03-10')).toBe(true)
 }finally{await t.close();await server.close()}
})
test('GitHub connection card does not call a completed synchronization unsynced',async()=>{
 const server=await fakeGithub(),t=await launchTestApp({githubAPI:server.url,syncReady:true});try{
  await t.page.evaluate(async c=>{await window.aia.connections.configure({id:'github',owner:c.owner,repo:c.repo,branch:'main',secret:'SYNTHETIC_ONLY'});await window.aia.connections.test('github');await window.aia.sync.run()},{owner:server.owner,repo:server.repo})
  await expect(t.page.getByRole('status',{name:'档案同步状态'})).toHaveText('已同步')
  await t.page.getByRole('navigation').getByRole('button',{name:'数据与设置',exact:true}).click()
  const card=t.page.getByRole('region',{name:'GitHub连接',exact:true})
  await expect(card.locator('.connection-status')).toHaveText('连接验证成功')
  await expect(card).not.toContainText('尚未同步')
  await card.getByRole('button',{name:'检查GitHub档案',exact:true}).click();await expect(card).toContainText('云端列表完整：')
  await expect(card).not.toContainText('尚未执行档案同步')
  const state=await t.page.evaluate(async()=>({connection:await window.aia.connections.getState(),sync:await window.aia.sync.getState()}))
  expect(state.connection.endpoints.github.status).toBe('verified');expect(state.sync.endpoints.github?.phase).toBe('synced');expect(state.sync.endpoints.github?.pending).toBe(0)
 }finally{await t.close();await server.close()}
})
