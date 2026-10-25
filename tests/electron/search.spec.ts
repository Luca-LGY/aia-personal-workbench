import { test,expect } from '@playwright/test'
import { launchTestApp } from '../helpers/electron-app'
import { makeRecord } from '../../src/shared/schemas'
import { writeFile,rm } from 'node:fs/promises'
import { join } from 'node:path'
test('native index finds Chinese short terms, body, parameters and literal punctuation and rebuilds',async()=>{const t=await launchTestApp();try{
 const records=[makeRecord('note',{title:'课堂',module:'learning',body:'早餐鸡蛋 ODE PDE 100% _literal_ "引用"'}),makeRecord('experiment',{title:'编号实验',module:'research',data:{experimentNo:'EXP-001',status:'completed',parameters:{扩散系数:'唯一参数'}}}),makeRecord('report',{title:'分析报告',body:'报告内的唯一结论'})]
 for(const record of records)await t.page.evaluate(record=>window.aia.records.save({record,expectedHash:null}),record)
 for(const query of ['早餐','蛋','ode','PDE','100%','_literal_','"引用"','唯一参数','唯一结论'])expect((await t.page.evaluate(query=>window.aia.search.query({query}),query)).total).toBe(1)
 expect((await t.page.evaluate(()=>window.aia.search.query({query:'唯一',module:'research'}))).items[0].kind).toBe('experiment')
 const hits=await t.page.evaluate(()=>window.aia.search.query({query:'早餐'}));expect(hits.items[0].excerpt).toContain('早餐');expect(hits.items[0].path).toContain('.md')
 const current=(await t.page.evaluate(id=>window.aia.records.get(id),records[0].id))!;await t.page.evaluate(v=>window.aia.records.save({record:{...v.record,body:'新的正文'},expectedHash:v.hash}),current)
 expect((await t.page.evaluate(()=>window.aia.search.query({query:'早餐'}))).total).toBe(0)
 await writeFile(join(t.archiveRoot,'外部报告.md'),'# 外部报告\n独立外部关键词')
 await expect.poll(async()=>(await t.page.evaluate(()=>window.aia.search.query({query:'独立外部关键词'}))).total).toBe(1)
 await t.page.evaluate(()=>window.aia.search.rebuild());expect((await t.page.evaluate(()=>window.aia.search.query({query:'独立外部关键词'}))).total).toBe(1)
 }finally{await t.close()}})
test('deleting disposable SQLite can be rebuilt from source documents',async()=>{const t=await launchTestApp();try{await t.page.evaluate(record=>window.aia.records.save({record,expectedHash:null}),makeRecord('note',{body:'索引重建唯一词'}));await t.app.close();for(const suffix of ['','-wal','-shm'])await rm(join(t.stateRoot,'cache','index.sqlite'+suffix),{force:true});const n=await launchTestApp({archiveRoot:t.archiveRoot,stateRoot:t.stateRoot});try{expect((await n.page.evaluate(()=>window.aia.search.query({query:'索引重建唯一词'}))).total).toBe(1)}finally{await n.close()}}finally{await t.close()}})
