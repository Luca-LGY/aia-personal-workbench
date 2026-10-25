import { test,expect } from '@playwright/test'
import { launchTestApp } from '../helpers/electron-app'
import { makeRecord } from '../../src/shared/schemas'
test('existing plan edits time and priority, and source shows completion and deferred date',async()=>{
 const t=await launchTestApp();try{
  const subject=makeRecord('subject',{title:'测试科目',module:'learning'}),note=makeRecord('note',{title:'测试笔记',module:'learning',date:'2026-10-25',data:{subjectId:subject.id,nextStep:'继续例题'}})
  await t.page.evaluate(async records=>{for(const record of records)await window.aia.records.save({record,expectedHash:null})},[subject,note])
  const plan=await t.page.evaluate(sourceId=>window.aia.plans.schedule({sourceId,date:'2026-10-25',time:'09:00',priority:'low'}),note.id)
  await t.page.getByRole('navigation').getByRole('button',{name:'今日计划',exact:true}).click()
  await t.page.getByRole('button',{name:'测试笔记',exact:true}).click()
  const dialog=t.page.getByRole('dialog',{name:'测试笔记'});await dialog.getByRole('button',{name:'编辑',exact:true}).click()
  await expect(dialog.getByLabel('计划时间',{exact:true})).toBeVisible()
  await dialog.getByLabel('计划时间',{exact:true}).fill('14:00');await dialog.getByLabel('计划优先级',{exact:true}).selectOption('high')
  await dialog.getByRole('button',{name:'保存修改',exact:true}).click();await expect(dialog).toHaveCount(0)
  await t.page.getByRole('button',{name:'完成计划：测试笔记'}).click()
  await t.page.getByRole('navigation').getByRole('button',{name:'学习数据',exact:true}).click();await t.page.getByRole('button',{name:'科目：测试科目'}).click()
  const related=t.page.getByRole('region',{name:'关联计划：'+note.id});await expect(related).toContainText('已完成');await expect(related).toContainText('14:00')
  const current=await t.page.evaluate(id=>window.aia.records.get(id),plan.id)
  await t.page.evaluate(v=>window.aia.plans.reschedule(v!.record.id,'2026-10-26',v!.hash),current)
  await expect(related).toContainText('2026-10-26')
  expect((await t.page.evaluate(id=>window.aia.records.get(id),plan.id))?.record.data.priority).toBe('high')
  expect((await t.page.evaluate(id=>window.aia.records.get(id),subject.id))?.record.data).not.toHaveProperty('mastery')
 }finally{await t.close()}
})
test('play history, development version and manual sport edit real structured values on the same IDs',async()=>{
 const t=await launchTestApp();let next:Awaited<ReturnType<typeof launchTestApp>>|undefined;try{
  const game=makeRecord('game',{title:'游戏档案',module:'games'}),project=makeRecord('dev_project',{title:'项目档案',module:'development'}),session=makeRecord('play_session',{title:'游玩档案',module:'games',date:'2026-10-25',data:{gameId:game.id,durationMin:null,progress:'旧游玩记录'}}),version=makeRecord('dev_version',{title:'版本档案',module:'development',date:'2026-10-25',data:{projectId:project.id,version:'v0.1',changes:'旧版本说明'}}),activity=makeRecord('activity',{title:'手动运动档案',module:'sports',date:'2026-10-25',data:{sport:'跑步',durationMin:10,distanceKm:null}})
  await t.page.evaluate(async records=>{for(const record of records)await window.aia.records.save({record,expectedHash:null})},[game,project,session,version,activity])
  for(const item of [{record:session,fields:[['游玩进展','新游玩进展'],['游玩时长（分钟）','42']]},{record:version,fields:[['版本号','v0.2'],['版本变化说明','新版本变化']]},{record:activity,fields:[['运动时长（分钟）','20'],['运动距离（公里）','3.5']]}]){
   await t.page.getByRole('button',{name:'打开档案：'+item.record.title,exact:true}).click();const dialog=t.page.getByRole('dialog',{name:item.record.title});await dialog.getByRole('button',{name:'编辑',exact:true}).click()
   await expect(dialog.getByLabel('记录日期',{exact:true})).toBeVisible();await dialog.getByLabel('记录日期',{exact:true}).fill('2026-10-24')
   for(const[label,value]of item.fields)await dialog.getByLabel(label,{exact:true}).fill(value)
   await dialog.getByRole('button',{name:'保存修改',exact:true}).click();await expect(dialog).toHaveCount(0)
  }
  await t.app.close();next=await launchTestApp({archiveRoot:t.archiveRoot,stateRoot:t.stateRoot})
  const s=await next.page.evaluate(id=>window.aia.records.get(id),session.id);expect(s?.record).toMatchObject({id:session.id,date:'2026-10-24',data:{durationMin:42,progress:'新游玩进展',gameId:game.id}})
  expect((await next.page.evaluate(id=>window.aia.records.get(id),version.id))?.record.data).toMatchObject({version:'v0.2',changes:'新版本变化',projectId:project.id})
  expect((await next.page.evaluate(id=>window.aia.records.get(id),activity.id))?.record.data).toMatchObject({durationMin:20,distanceKm:3.5})
  expect((await next.page.evaluate(()=>window.aia.search.query({query:'新游玩进展'}))).items[0].recordId).toBe(session.id)
  expect((await next.page.evaluate(()=>window.aia.search.query({query:'旧版本说明'}))).total).toBe(0)
 }finally{await next?.close();await t.close()}
})
test('home includes source-backed highlights for every domain',async()=>{
 const t=await launchTestApp();try{
  const records=[makeRecord('note',{title:'学习重点',module:'learning',date:'2026-10-25',body:'学习来源正文'}),makeRecord('experiment',{title:'实验重点',module:'research',date:'2026-10-25',data:{experimentNo:'E-HOME',status:'running',result:'实验实际结果'}}),makeRecord('meal',{title:'饮食重点',module:'diet',date:'2026-10-25',data:{meal:'breakfast',description:'已记录早餐',consumed:true}}),makeRecord('game',{title:'娱乐重点',module:'games',data:{status:'playing',progress:'实际游戏进度'}}),makeRecord('dev_project',{title:'开发重点',module:'development',data:{goal:'实际开发目标',stage:'开发中'}})]
  await t.page.evaluate(async records=>{for(const record of records)await window.aia.records.save({record,expectedHash:null})},records)
  for(const label of ['学习数据','科研实验','运动计划','饮食计划','游戏娱乐','开发工作'])await expect(t.page.getByRole('region',{name:'模块摘要：'+label})).toBeVisible()
  await expect(t.page.getByRole('region',{name:'模块摘要：科研实验'})).toContainText('实验实际结果')
  await t.page.getByRole('button',{name:'查看摘要档案：学习数据',exact:true}).click();await expect(t.page.getByRole('dialog',{name:'学习重点'})).toBeVisible()
 }finally{await t.close()}
})
test('midnight and wake update today without resetting a chosen historical date',async()=>{
 const t=await launchTestApp({now:'2026-10-25T23:59:00+08:00'});try{
  await t.page.evaluate(async()=>{await window.aia.plans.schedule({title:'昨日安排',date:'2026-10-25'});await window.aia.plans.schedule({title:'新日安排',date:'2026-10-26'})})
  await expect(t.page.getByRole('button',{name:'完成计划：昨日安排'})).toBeVisible()
  await t.page.getByRole('navigation').getByRole('button',{name:'今日计划',exact:true}).click();await t.page.getByLabel('查看日期',{exact:true}).fill('2026-10-24')
  await t.app.evaluate(({powerMonitor})=>{process.env.AIA_NOW='2026-10-26T00:01:00+08:00';powerMonitor.emit('resume')})
  await expect(t.page.getByLabel('查看日期',{exact:true})).toHaveValue('2026-10-24')
  await t.page.getByRole('navigation').getByRole('button',{name:'首页总览',exact:true}).click()
  await expect(t.page.getByRole('button',{name:'完成计划：新日安排'})).toBeVisible();await expect(t.page.getByRole('button',{name:'完成计划：昨日安排'})).toHaveCount(0)
  await t.page.getByRole('navigation').getByRole('button',{name:'今日计划',exact:true}).click();await expect(t.page.getByLabel('查看日期',{exact:true})).toHaveValue('2026-10-26')
 }finally{await t.close()}
})
test('explicit quit drains an already submitted save before exiting',async()=>{
 const t=await launchTestApp();let next:Awaited<ReturnType<typeof launchTestApp>>|undefined;try{
  const record=makeRecord('document',{title:'退出时保存',body:'需要持久化的记录'.repeat(200000)})
  await t.page.evaluate(async r=>{void window.aia.records.save({record:r,expectedHash:null});await window.aia.runtime()},record)
  await t.app.close();next=await launchTestApp({archiveRoot:t.archiveRoot,stateRoot:t.stateRoot})
  expect((await next.page.evaluate(id=>window.aia.records.get(id),record.id))?.record.body===record.body).toBe(true)
 }finally{await next?.close();await t.close()}
})
