import { test,expect } from '@playwright/test'
import { mkdtemp,mkdir,writeFile,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeRecord } from '../../src/shared/schemas'
import { serializeRecord } from '../../src/main/archive/codec'
import { launchTestApp } from '../helpers/electron-app'
test('10000-record warm Chinese keyword lookup remains usable',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'aia-search-scale-')),archiveRoot=join(dir,'archive'),stateRoot=join(dir,'state');await mkdir(archiveRoot)
 try{for(let start=0;start<10000;start+=32)await Promise.all(Array.from({length:Math.min(32,10000-start)},(_,n)=>{const i=start+n;return writeFile(join(archiveRoot,`${i}.md`),serializeRecord(makeRecord('note',{title:`测试记录${i}`,body:i===9999?'目标关键词':'普通课程记录'})))}))
 const t=await launchTestApp({archiveRoot,stateRoot});try{await t.page.evaluate(()=>window.aia.search.rebuild());const result=await t.page.evaluate(async()=>{const before=performance.now();const page=await window.aia.search.query({query:'目标关键词'});return{total:page.total,ms:performance.now()-before}});expect(result.total).toBe(1);expect(result.ms).toBeLessThan(500);console.log(`10000-record warm query: ${result.ms.toFixed(1)}ms`)}finally{await t.close()}
 }finally{await rm(dir,{recursive:true,force:true})}
})
