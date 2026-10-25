import { _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
export async function launchTestApp(options: { archiveRoot?:string; stateRoot?:string; now?:string; packaged?:string;captureReplyDelayMs?:number } = {}) {
  const temp = await mkdtemp(join(tmpdir(),'aia-test-'))
  const archiveRoot=options.archiveRoot??join(temp,'archive'), stateRoot=options.stateRoot??join(temp,'state')
  await mkdir(archiveRoot,{recursive:true}); await mkdir(stateRoot,{recursive:true})
  const env:Record<string,string>={...Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined)),AIA_TEST_MODE:'1',AIA_ARCHIVE_ROOT:archiveRoot,AIA_STATE_ROOT:stateRoot,AIA_NOW:options.now??'2026-10-25T10:00:00+08:00'}
  delete env.ELECTRON_RUN_AS_NODE
  if(options.captureReplyDelayMs)env.AIA_TEST_CAPTURE_REPLY_DELAY=String(options.captureReplyDelayMs)
  const app=await electron.launch({args:options.packaged?[]:[resolve('out/main/index.js')],...(options.packaged?{executablePath:options.packaged}:{}),env})
  const page=await app.firstWindow()
  return {app,page,archiveRoot,stateRoot,temp,async close(){await closeApp(app);await rm(temp,{recursive:true,force:true})}}
}
async function closeApp(app:ElectronApplication){try{await app.close()}catch{/* app may already have explicitly quit */}}
