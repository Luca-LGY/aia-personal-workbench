import { test,expect } from '@playwright/test'
import { launchTestApp } from '../helpers/electron-app'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
test('isolated desktop starts with native SQLite and no renderer Node privileges',async()=>{
  const t=await launchTestApp()
  try{
    await expect(t.page.getByRole('heading',{name:'我的工作台'})).toBeVisible()
    const info=await t.page.evaluate(()=>window.aia.runtime())
    expect(info.archiveRoot).toBe(t.archiveRoot)
    expect(info.stateRoot).toBe(t.stateRoot)
    expect(info.sqliteReady).toBe(true)
    expect((await readFile(join(t.stateRoot,'cache','index.sqlite'))).subarray(0,15).toString()).toBe('SQLite format 3')
    expect(await t.page.evaluate(()=>typeof (window as unknown as {require?:unknown}).require)).toBe('undefined')
    expect(await t.page.evaluate(()=>typeof (window as unknown as {process?:unknown}).process)).toBe('undefined')
  }finally{await t.close()}
})
