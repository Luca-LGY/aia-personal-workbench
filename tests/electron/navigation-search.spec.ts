import { test,expect } from '@playwright/test'
import { launchTestApp } from '../helpers/electron-app'
import { makeRecord } from '../../src/shared/schemas'
test('selected shell has ten flat entries and search opens the actual record',async()=>{const t=await launchTestApp();try{
 const nav=t.page.getByRole('navigation',{name:'模块导航'})
 await expect(nav.getByRole('button')).toHaveText(['首页总览','快速寻找','今日计划','学习数据','科研实验','运动计划','饮食计划','游戏娱乐','开发工作','数据与设置'])
 await expect(t.page.getByText('今天早餐吃了鸡蛋。',{exact:true})).toHaveCount(0)
 const r=makeRecord('note',{title:'正文定位档案',module:'learning',body:'这里有唯一的正文关键词'})
 await t.page.evaluate(record=>window.aia.records.save({record,expectedHash:null}),r)
 await t.page.getByRole('textbox',{name:'全局关键词搜索'}).fill('正文关键词')
 await t.page.getByRole('textbox',{name:'全局关键词搜索'}).press('Enter')
 await expect(t.page.getByRole('heading',{name:'快速寻找',exact:true})).toBeVisible()
 await t.page.getByRole('button',{name:'打开档案：正文定位档案'}).click()
 await expect(t.page.getByRole('dialog',{name:'正文定位档案'})).toBeVisible()
 await expect(t.page.getByRole('dialog',{name:'正文定位档案'}).locator('mark')).toContainText('正文关键词')
 const loc=await t.page.evaluate(id=>window.aia.sources.resolve(id),r.id);expect(loc.exists).toBe(true);expect(loc.path).toContain(t.archiveRoot)
 await t.page.getByRole('button',{name:'关闭详情'}).click()
 await nav.getByRole('button',{name:'今日计划',exact:true}).click();await expect(t.page.getByRole('heading',{name:'今日计划',exact:true})).toBeVisible()
 await nav.getByRole('button',{name:'快速寻找',exact:true}).click();await expect(t.page.getByRole('textbox',{name:'全局关键词搜索'})).toHaveValue('正文关键词')
 }finally{await t.close()}})
