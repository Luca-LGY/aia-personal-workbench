import { test,expect } from '@playwright/test'
import { launchTestApp } from '../helpers/electron-app'
import { fakeWebdav } from '../helpers/fake-webdav'
import { makeRecord } from '../../src/shared/schemas'
import { serializeRecord } from '../../src/main/archive/codec'
import { mkdir,writeFile } from 'node:fs/promises'
import { join } from 'node:path'

test('reviewed cloud differences visibly identify additions, edits, deletions, direction and comparison time',async()=>{
 const dav=await fakeWebdav(),t=await launchTestApp({syncReady:true});try{
  await t.page.evaluate(async url=>{await window.aia.connections.configure({id:'webdav',url,username:'synthetic',secret:'SYNTHETIC_ONLY'});await window.aia.connections.test('webdav');await window.aia.sync.run()},dav.url)
  const edit=makeRecord('document',{title:'修改项',body:'old'}),remove=makeRecord('document',{title:'删除项',body:'old'})
  await t.page.evaluate(async records=>{for(const record of records)await window.aia.records.save({record,expectedHash:null});await window.aia.sync.run()},[edit,remove])
  const e=(await t.page.evaluate(id=>window.aia.records.get(id),edit.id))!,r=(await t.page.evaluate(id=>window.aia.records.get(id),remove.id))!
  // The restore guard lets us inspect all differences without publishing them first.
  const ready=join(t.stateRoot,'settings/archive-ready.json');await writeFile(ready,JSON.stringify({ready:false}));await t.app.close()
  const next=await launchTestApp({archiveRoot:t.archiveRoot,stateRoot:t.stateRoot});try{
   await next.page.evaluate(async p=>{await window.aia.records.save({record:{...p.e.record,body:'edited'},expectedHash:p.e.hash});await window.aia.records.remove(p.r.record.id,p.r.hash);await window.aia.records.save({record:p.add,expectedHash:null});await window.aia.sync.run()},{e,r,add:makeRecord('document',{title:'新增项',body:'new'})})
   await next.page.getByRole('button',{name:'查看变更',exact:true}).click();const region=next.page.getByRole('region',{name:'本轮变更比较'});await expect(region).toContainText('来源已完整比较');await expect(region).toContainText('新增');await expect(region).toContainText('修改');await expect(region).toContainText('删除');await expect(region).toContainText('坚果云 WebDAV');const state=await next.page.evaluate(()=>window.aia.sync.getState());await expect(region).toContainText(state.comparison!.at);await expect(region).toContainText(e.path);await expect(region).toContainText(r.path)
  }finally{await next.close()}
 }finally{await t.close();await dav.close()}
})

test('a file actually archived externally becomes searchable while a chat-only sentence stays absent',async()=>{
 const t=await launchTestApp();try{const archived=makeRecord('document',{module:'learning',title:'合成授权工具落档',body:'实际落档边界唯一词'}),chatOnly='仅聊天未落档边界唯一词';const dir=join(t.archiveRoot,'学习数据');await mkdir(dir,{recursive:true});await writeFile(join(dir,'授权落档.md'),serializeRecord(archived));await expect.poll(async()=>(await t.page.evaluate(()=>window.aia.search.query({query:'实际落档边界唯一词'}))).items.map(i=>i.recordId)).toContain(archived.id);expect((await t.page.evaluate(query=>window.aia.search.query({query}),chatOnly)).items).toHaveLength(0);await t.page.getByLabel('全局关键词搜索').fill('实际落档边界唯一词');await t.page.getByLabel('全局关键词搜索').press('Enter');await expect(t.page.getByRole('button',{name:/合成授权工具落档/})).toBeVisible()}finally{await t.close()}
})

test('search module, type and inclusive date filters narrow real content without changing its identity',async()=>{
 const t=await launchTestApp();try{
  const records=[makeRecord('note',{module:'learning',title:'目标筛选记录',date:'2026-10-25',body:'筛选验收关键词'}),makeRecord('document',{module:'learning',title:'不同类型',date:'2026-10-25',body:'筛选验收关键词'}),makeRecord('note',{module:'learning',title:'不同日期',date:'2026-10-24',body:'筛选验收关键词'}),makeRecord('document',{module:'research',title:'不同模块',date:'2026-10-25',body:'筛选验收关键词'})]
  await t.page.evaluate(async records=>{for(const record of records)await window.aia.records.save({record,expectedHash:null})},records);await t.page.getByLabel('全局关键词搜索').fill('筛选验收关键词');await t.page.getByLabel('全局关键词搜索').press('Enter');await expect(t.page.getByText('找到 4 份内容',{exact:true})).toBeVisible();await t.page.getByLabel('搜索模块',{exact:true}).selectOption('learning');await expect(t.page.getByText('找到 3 份内容',{exact:true})).toBeVisible();await t.page.getByLabel('搜索类型',{exact:true}).selectOption('note');await expect(t.page.getByText('找到 2 份内容',{exact:true})).toBeVisible();await t.page.getByLabel('搜索开始日期',{exact:true}).fill('2026-10-25');await t.page.getByLabel('搜索结束日期',{exact:true}).fill('2026-10-25');await expect(t.page.getByText('找到 1 份内容',{exact:true})).toBeVisible();await t.page.getByRole('button',{name:'打开档案：目标筛选记录',exact:true}).click();await expect(t.page.getByRole('dialog',{name:'目标筛选记录'})).toContainText(records[0].body)
 }finally{await t.close()}
})
