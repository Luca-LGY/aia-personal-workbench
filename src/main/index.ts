import { app,BrowserWindow,ipcMain,powerMonitor } from 'electron'
import { mkdirSync } from 'node:fs'
import { join,dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { createServices } from './services'
import { registerIPC } from './ipc'
import { ArchiveLease } from './sync/archive-lease'
import { createTray } from './tray'
const dir=dirname(fileURLToPath(import.meta.url))
const testMode=process.env.AIA_TEST_MODE==='1'
app.setName('AIA 工作台')
if(testMode&&process.env.AIA_STATE_ROOT)app.setPath('userData',process.env.AIA_STATE_ROOT)
else{const ownState=join(app.getPath('appData'),'AIA-Workbench');mkdirSync(ownState,{recursive:true});app.setPath('userData',ownState)}
app.whenReady().then(async()=>{
const stateRoot=app.getPath('userData')
const archiveRoot=testMode?process.env.AIA_ARCHIVE_ROOT!:join(stateRoot,'archive')
mkdirSync(join(stateRoot,'cache'),{recursive:true});mkdirSync(archiveRoot,{recursive:true})
const lease=await ArchiveLease.acquire(archiveRoot,true)
const db=new Database(join(stateRoot,'cache','index.sqlite'))
db.exec('CREATE TABLE IF NOT EXISTS app_metadata(key TEXT PRIMARY KEY,value TEXT); INSERT OR IGNORE INTO app_metadata VALUES(\'schema\',\'1\')')
const services=await createServices(archiveRoot,stateRoot,db,()=>new Date(testMode&&process.env.AIA_NOW?process.env.AIA_NOW:Date.now()),testMode)
const ipc=registerIPC(services,{captureReplyDelayMs:testMode?Math.min(3000,Math.max(0,Number(process.env.AIA_TEST_CAPTURE_REPLY_DELAY)||0)):0})
powerMonitor.on('resume',()=>{for(const w of BrowserWindow.getAllWindows())w.webContents.send('aia:wake')})
ipcMain.handle('aia:runtime',()=>({archiveRoot,stateRoot,now:testMode&&process.env.AIA_NOW?process.env.AIA_NOW:new Date().toISOString(),sqliteReady:!!db.prepare('SELECT value FROM app_metadata WHERE key=?').get('schema')}))
const win=new BrowserWindow({width:1487,height:1058,useContentSize:true,title:'我的工作台',backgroundColor:'#FAF9F5',webPreferences:{preload:join(dir,'../preload/index.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}})
const background=!testMode||process.env.AIA_TEST_BACKGROUND==='1'
const destroyTray=background?createTray(win,services.coordinator):()=>{}
let readyToQuit=false,quitting=false
win.on('close',event=>{if(background&&!quitting){event.preventDefault();win.hide()}})
app.on('activate',()=>{win.show();win.focus()})
app.on('window-all-closed',()=>{if(!background)app.quit()})
app.on('will-quit',()=>db.close())
app.on('before-quit',event=>{if(readyToQuit)return;quitting=true;event.preventDefault();services.scheduler.stop();void services.coordinator.stop();void ipc.drain().then(()=>services.coordinator.stop()).then(()=>services.stopWatcher()).then(()=>lease.release()).then(()=>{destroyTray();readyToQuit=true;app.quit()})})
const initialHash=process.argv.includes('--aia-open-settings')?'/settings':'/'
win.webContents.setWindowOpenHandler(()=>({action:'deny'}))
if(process.env.ELECTRON_RENDERER_URL)await win.loadURL(process.env.ELECTRON_RENDERER_URL+'#'+initialHash)
else await win.loadFile(join(dir,'../renderer/index.html'),{hash:initialHash})
services.scheduler.start()
})
