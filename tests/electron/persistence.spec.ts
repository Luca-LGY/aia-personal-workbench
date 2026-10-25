import { test,expect } from '@playwright/test'
import { launchTestApp } from '../helpers/electron-app'
import { makeRecord } from '../../src/shared/schemas'
test('acknowledged records and drafts persist across reload and process death',async()=>{
 const t=await launchTestApp();const r=makeRecord('note',{title:'重启唯一词',body:'已保存原文'})
 try{
  await t.page.evaluate(record=>window.aia.records.save({record,expectedHash:null}),r)
  await t.page.evaluate(()=>window.aia.drafts.save('home','尚未归档的原句'))
  await t.page.reload();expect((await t.page.evaluate(id=>window.aia.records.get(id),r.id))?.record.body).toBe('已保存原文')
  t.app.process().kill('SIGKILL')
  const next=await launchTestApp({archiveRoot:t.archiveRoot,stateRoot:t.stateRoot})
  try{expect((await next.page.evaluate(id=>window.aia.records.get(id),r.id))?.record.title).toBe('重启唯一词');expect(await next.page.evaluate(()=>window.aia.drafts.get('home'))).toBe('尚未归档的原句')}finally{await next.close()}
 }finally{await t.close()}
})
