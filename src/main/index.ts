import { app,BrowserWindow,ipcMain } from 'electron'
import { mkdirSync } from 'node:fs'
import { join,dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { createServices } from './services'
import { registerIPC } from './ipc'
const dir=dirname(fileURLToPath(import.meta.url))
const testMode=process.env.AIA_TEST_MODE==='1'
if(testMode&&process.env.AIA_STATE_ROOT)app.setPath('userData',process.env.AIA_STATE_ROOT)
app.whenReady().then(async()=>{
const stateRoot=app.getPath('userData')
const archiveRoot=testMode?process.env.AIA_ARCHIVE_ROOT!:join(stateRoot,'archive')
mkdirSync(join(stateRoot,'cache'),{recursive:true});mkdirSync(archiveRoot,{recursive:true})
const db=new Database(join(stateRoot,'cache','index.sqlite'))
db.exec('CREATE TABLE IF NOT EXISTS app_metadata(key TEXT PRIMARY KEY,value TEXT); INSERT OR IGNORE INTO app_metadata VALUES(\'schema\',\'1\')')
const services=await createServices(archiveRoot,stateRoot)
registerIPC(services)
ipcMain.handle('aia:runtime',()=>({archiveRoot,stateRoot,sqliteReady:!!db.prepare('SELECT value FROM app_metadata WHERE key=?').get('schema')}))
const win=new BrowserWindow({width:1487,height:1058,backgroundColor:'#FAF9F5',webPreferences:{preload:join(dir,'../preload/index.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}})
win.webContents.setWindowOpenHandler(()=>({action:'deny'}))
if(process.env.ELECTRON_RENDERER_URL)await win.loadURL(process.env.ELECTRON_RENDERER_URL)
else await win.loadFile(join(dir,'../renderer/index.html'))
app.on('window-all-closed',()=>app.quit())
app.on('will-quit',()=>db.close())
})
