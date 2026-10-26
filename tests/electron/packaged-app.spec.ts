import { test,expect } from '@playwright/test'
import { mkdtemp,mkdir,writeFile,readFile,rm,stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join,isAbsolute,resolve } from 'node:path'
import { launchTestApp } from '../helpers/electron-app'
import { makeRecord } from '../../src/shared/schemas'
import { createHash } from 'node:crypto'

test('packaged Mac app loads bundled UI and native SQLite, persists records and attachments across explicit quit, and keeps local use available without encryption',async()=>{
 const executable=resolve('dist/mac-arm64/我的工作台.app/Contents/MacOS/我的工作台')
 expect((await stat(executable)).isFile()).toBe(true)
 const root=await mkdtemp(join(tmpdir(),'aia-packaged-')),archiveRoot=join(root,'archive'),stateRoot=join(root,'state');let first:Awaited<ReturnType<typeof launchTestApp>>|undefined,next:Awaited<ReturnType<typeof launchTestApp>>|undefined
 try{
  await mkdir(archiveRoot,{recursive:true});await mkdir(stateRoot,{recursive:true});first=await launchTestApp({packaged:executable,archiveRoot,stateRoot})
  expect(await first.app.evaluate(({app})=>({packaged:app.isPackaged,path:app.getAppPath()}))).toMatchObject({packaged:true,path:expect.stringContaining('app.asar')})
  expect(first.page.url()).toMatch(/^file:/);expect((await first.page.evaluate(()=>window.aia.runtime())).sqliteReady).toBe(true)
  const bytes=Buffer.from([0,1,128,255,9]),input=join(root,'合成附件.bin');await writeFile(input,bytes);await first.app.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]})},input)
  const [attachment]=await first.page.evaluate(()=>window.aia.attachments.choose());expect(isAbsolute(attachment.path)).toBe(false);expect(attachment.hash).toBe(createHash('sha256').update(bytes).digest('hex'))
  const note=makeRecord('note',{module:'learning',title:'打包重开验收',date:'2026-10-25',body:'打包应用独立持久化关键词',attachmentIds:[attachment.id]})
  await first.page.evaluate(async record=>{await window.aia.records.save({record,expectedHash:null});await window.aia.drafts.save('home','尚未提交的打包草稿')},note)
  const child=first.app.process(),exited=new Promise<void>(r=>child.once('exit',()=>r()));await first.app.evaluate(({app})=>app.quit());await exited;await first.close();first=undefined
  next=await launchTestApp({packaged:executable,archiveRoot,stateRoot})
  expect((await next.page.evaluate(()=>window.aia.search.query({query:'打包应用独立持久化关键词'}))).items[0].recordId).toBe(note.id)
  expect(await next.page.evaluate(()=>window.aia.drafts.get('home'))).toBe('尚未提交的打包草稿')
  const stored=await next.page.evaluate(id=>window.aia.attachments.resolve(id),attachment.id);expect(stored?.hash).toBe(attachment.hash);expect(await readFile(join(archiveRoot,attachment.path))).toEqual(bytes)
  await next.app.evaluate(({safeStorage})=>{safeStorage.isAsyncEncryptionAvailable=async()=>false})
  await next.page.getByRole('navigation').getByRole('button',{name:'数据与设置',exact:true}).click()
  await next.page.getByLabel('坚果云WebDAV地址').fill('https://example.invalid/dav/app/')
  await next.page.getByLabel('坚果云用户名').fill('synthetic-user');await next.page.getByLabel('坚果云应用密码').fill('TEST_ONLY_UNAVAILABLE_SECRET')
  await next.page.getByRole('button',{name:'保存坚果云连接',exact:true}).click();await expect(next.page.getByRole('status',{name:'操作提示'})).toContainText('本机档案仍可使用')
  const local=makeRecord('document',{title:'加密不可用后仍保存',body:'本机功能继续可用'});await next.page.evaluate(record=>window.aia.records.save({record,expectedHash:null}),local)
  expect((await next.page.evaluate(id=>window.aia.records.get(id),local.id))?.record.body).toBe(local.body)
 }finally{await first?.close();await next?.close();await rm(root,{recursive:true,force:true})}
})
