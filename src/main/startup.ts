import { app,BrowserWindow,shell,dialog } from 'electron'
import Database from 'better-sqlite3'
import { rename } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { inspectBackup,restoreBackup } from './backup/restorer'
import { WorkspaceService } from './workspace'
import { atomicWrite,readMaybe } from './archive/transactions'
export async function openIndex(path:string){
 const initialize=()=>{const db=new Database(path);try{db.exec("CREATE TABLE IF NOT EXISTS app_metadata(key TEXT PRIMARY KEY,value TEXT); INSERT OR IGNORE INTO app_metadata VALUES('schema','1')");return db}catch(e){db.close();throw e}}
 try{return initialize()}catch(error){if(!['SQLITE_NOTADB','SQLITE_CORRUPT'].includes((error as {code?:string}).code??''))throw error;const suffix='.unreadable-'+randomUUID();await rename(path,path+suffix);for(const side of ['-wal','-shm'])try{await rename(path+side,path+suffix+side)}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}return initialize()}
}
export async function showStartupFailure(error:unknown,dataRoot:string,existing?:BrowserWindow){
 const text=error instanceof Error?error.message:'启动时发生错误',escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
 const win=existing&&!existing.isDestroyed()?existing:new BrowserWindow({width:760,height:480,title:'工作台恢复',backgroundColor:'#FAF9F5',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}})
 win.setTitle('工作台恢复');win.setContentSize(760,480)
 let busy=false
 const occupied=/占用|锁已失效/.test(text)
 const render=async(message:string)=>{const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{font:16px -apple-system,'PingFang SC',sans-serif;background:#FAF9F5;color:#24352F;padding:28px;line-height:1.8}h1{font-size:26px}pre{white-space:pre-wrap}a{color:#376958;margin-right:24px}</style><h1>暂时无法打开工作台</h1><p>原档案已保留，没有自动切换或覆盖数据。请查看下方原因，修复设置或使用已有完整备份后重新打开。</p><pre>${escape(message)}</pre><p>数据位置：${escape(dataRoot)}</p><a href="aia-startup://folder">在 Finder 中查看数据位置</a>${occupied?'':'<a href="aia-startup://restore">从完整备份恢复到新目录</a>'}<a href="aia-startup://retry">重新打开</a><a href="aia-startup://quit">退出 APP</a></html>`;await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html))}
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(event,url)=>{event.preventDefault();if(url==='aia-startup://folder')shell.showItemInFolder(dataRoot);else if(url==='aia-startup://retry'){app.relaunch();app.quit()}else if(url==='aia-startup://quit')app.quit();else if(url==='aia-startup://restore'&&!occupied&&!busy){busy=true;void(async()=>{try{const input=await dialog.showOpenDialog(win,{title:'选择完整备份',properties:['openFile'],filters:[{name:'完整备份',extensions:['zip']}]});if(input.canceled)return;const preview=await inspectBackup(input.filePaths[0]);const parent=await dialog.showOpenDialog(win,{title:'选择当前档案之外的位置，恢复到新目录',properties:['openDirectory','createDirectory']});if(parent.canceled)return;const target=join(parent.filePaths[0],'AIA恢复-'+randomUUID()),restored=await restoreBackup(input.filePaths[0],target,{archiveRoot:join(dataRoot,'archive'),stateRoot:dataRoot},{},preview.fingerprint);const pointer=await readMaybe(join(dataRoot,'settings/workspace.json'));if(pointer){const saved=join(dataRoot,'settings/workspace.before-recovery.json');await atomicWrite(await readMaybe(saved)?join(dataRoot,'settings','workspace.before-recovery-'+randomUUID()+'.json'):saved,pointer);}await new WorkspaceService(dataRoot).select(restored);await render('已恢复到独立目录：'+restored.target+'。原档案与原位置设置已保留，云端发布已暂停。请点击“重新打开”。')}catch(e){await render('恢复未完成，原档案保留。'+(e instanceof Error?e.message:String(e)))}finally{busy=false}})()}});win.on('closed',()=>app.quit());await render(text)
}
