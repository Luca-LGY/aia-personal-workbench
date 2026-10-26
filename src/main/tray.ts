import { Tray,Menu,nativeImage,app,type BrowserWindow } from 'electron'
import type { SyncCoordinator } from './sync/coordinator'
export function createTray(window:BrowserWindow,coordinator:SyncCoordinator){
 const icon=nativeImage.createFromNamedImage('NSBookmarksTemplate');icon.setTemplateImage(true);const tray=new Tray(icon);tray.setToolTip('我的工作台：本机档案与云端同步')
 const labels:Record<string,string>={synced:'已同步',pending:'等待补同步',conflict:'有冲突待处理',suspended:'恢复后暂停发布',setup_required:'待完成档案接入',idle:'本机档案',scanning:'正在比较',planning:'正在比较',applying:'接回本机',publishing:'同步中',verifying:'核对中'}
 const show=()=>{window.show();window.focus()},update=()=>{const state=coordinator.getState();tray.setContextMenu(Menu.buildFromTemplate([{label:'打开我的工作台',click:show},{label:labels[state.phase]??'正在同步',enabled:false},{type:'separator'},{label:'立即同步',click:()=>{void coordinator.run('manual')}},{label:'退出我的工作台',click:()=>app.quit()}]))};update();const off=coordinator.onChange(update);tray.on('click',show);return()=>{off();tray.destroy()}
}
