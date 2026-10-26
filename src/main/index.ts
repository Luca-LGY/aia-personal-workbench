import { app,BrowserWindow,ipcMain,powerMonitor } from 'electron'
import { mkdirSync } from 'node:fs'
import { join,dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openIndex,showStartupFailure } from './startup'
import type Database from 'better-sqlite3'
import { createServices,type Services } from './services'
import { registerIPC } from './ipc'
import { ArchiveLease } from './sync/archive-lease'
import { createTray } from './tray'
import { loadWorkspace } from './workspace'
const dir=dirname(fileURLToPath(import.meta.url))
const testMode=process.env.AIA_TEST_MODE==='1'
app.setName('AIA 工作台')
if(testMode&&process.env.AIA_STATE_ROOT)app.setPath('userData',process.env.AIA_STATE_ROOT)
else{const ownState=join(app.getPath('appData'),'AIA-Workbench');mkdirSync(ownState,{recursive:true});app.setPath('userData',ownState)}
let startupLease:ArchiveLease|undefined,startupDB:Database.Database|undefined,startupServices:Services|undefined,startupIPC:ReturnType<typeof registerIPC>|undefined,startupWindow:BrowserWindow|undefined,startupRemoveClose:(()=>void)|undefined
app.whenReady().then(async()=>{
const baseRoot=app.getPath('userData'),fallback={stateRoot:baseRoot,archiveRoot:testMode?process.env.AIA_ARCHIVE_ROOT!:join(baseRoot,'archive')}
const {archiveRoot,stateRoot}=testMode&&process.env.AIA_TEST_USE_WORKSPACE!=='1'?fallback:await loadWorkspace(baseRoot,fallback)
mkdirSync(join(stateRoot,'cache'),{recursive:true});mkdirSync(archiveRoot,{recursive:true})
const lease=await ArchiveLease.acquire(archiveRoot,true);startupLease=lease
const db=await openIndex(join(stateRoot,'cache','index.sqlite'));startupDB=db
const services=await createServices(archiveRoot,stateRoot,db,()=>new Date(testMode&&process.env.AIA_NOW?process.env.AIA_NOW:Date.now()),testMode,baseRoot);startupServices=services
const ipc=registerIPC(services,{captureReplyDelayMs:testMode?Math.min(3000,Math.max(0,Number(process.env.AIA_TEST_CAPTURE_REPLY_DELAY)||0)):0});startupIPC=ipc
powerMonitor.on('resume',()=>{for(const w of BrowserWindow.getAllWindows())w.webContents.send('aia:wake')})
ipcMain.handle('aia:runtime',()=>({archiveRoot,stateRoot,now:testMode&&process.env.AIA_NOW?process.env.AIA_NOW:new Date().toISOString(),sqliteReady:!!db.prepare('SELECT value FROM app_metadata WHERE key=?').get('schema')}))
const win=new BrowserWindow({width:1487,height:1058,useContentSize:true,title:'我的工作台',backgroundColor:'#FAF9F5',webPreferences:{preload:join(dir,'../preload/index.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}})
startupWindow=win
const background=!testMode||process.env.AIA_TEST_BACKGROUND==='1'
let readyToQuit=false,quitting=false
const hideOnClose=(event:Electron.Event)=>{if(background&&!quitting){event.preventDefault();win.hide()}};win.on('close',hideOnClose);startupRemoveClose=()=>win.removeListener('close',hideOnClose)
const initialHash=process.argv.includes('--aia-open-settings')?'/settings':'/'
win.webContents.setWindowOpenHandler(()=>({action:'deny'}))
if(!app.isPackaged&&process.env.ELECTRON_RENDERER_URL)await win.loadURL(process.env.ELECTRON_RENDERER_URL+'#'+initialHash)
else await win.loadFile(join(dir,'../renderer/index.html'),{hash:initialHash})
const destroyTray=background?createTray(win,services.coordinator,services.gate):()=>{}
app.on('activate',()=>{win.show();win.focus()})
app.on('window-all-closed',()=>{if(!background)app.quit()})
app.on('will-quit',()=>db.close())
app.on('before-quit',event=>{if(readyToQuit)return;quitting=true;event.preventDefault();services.scheduler.stop();void services.coordinator.stop();void ipc.drain().then(()=>services.coordinator.stop()).then(()=>services.stopWatcher()).then(()=>lease.release()).then(()=>{destroyTray();readyToQuit=true;app.quit()})})
services.scheduler.start()
}).catch(async error=>{startupRemoveClose?.();startupServices?.scheduler.stop();await startupIPC?.drain().catch(()=>{});await startupServices?.coordinator.stop().catch(()=>{});await startupServices?.stopWatcher().catch(()=>{});try{startupDB?.close()}catch{/* database may already be closed */}await startupLease?.release().catch(()=>{});await showStartupFailure(error,app.getPath('userData'),startupWindow)})
