import { contextBridge,ipcRenderer } from 'electron'
import type { AiaAPI } from '../shared/api'
const api:AiaAPI={
 runtime:()=>ipcRenderer.invoke('aia:runtime'),
 records:{list:filter=>ipcRenderer.invoke('records:list',filter),get:id=>ipcRenderer.invoke('records:get',id),save:input=>ipcRenderer.invoke('records:save',input),remove:(id,hash)=>ipcRenderer.invoke('records:remove',id,hash),restore:id=>ipcRenderer.invoke('records:restore',id)},
 drafts:{get:key=>ipcRenderer.invoke('drafts:get',key),save:(key,text)=>ipcRenderer.invoke('drafts:save',key,text)},
 attachments:{choose:()=>ipcRenderer.invoke('attachments:choose'),resolve:id=>ipcRenderer.invoke('attachments:resolve',id),open:id=>ipcRenderer.invoke('attachments:open',id)},
 capture:{preview:(text,attachmentIds)=>ipcRenderer.invoke('capture:preview',text,attachmentIds),commit:p=>ipcRenderer.invoke('capture:commit',p),undo:id=>ipcRenderer.invoke('capture:undo',id)},
 plans:{schedule:p=>ipcRenderer.invoke('plans:schedule',p),listDay:date=>ipcRenderer.invoke('plans:listDay',date),setStatus:(id,status,hash)=>ipcRenderer.invoke('plans:setStatus',id,status,hash),reschedule:(id,date,hash)=>ipcRenderer.invoke('plans:reschedule',id,date,hash)},
 diet:{listDay:date=>ipcRenderer.invoke('diet:listDay',date),saveMeal:p=>ipcRenderer.invoke('diet:saveMeal',p)},
 research:{listProjects:()=>ipcRenderer.invoke('research:listProjects'),getProject:id=>ipcRenderer.invoke('research:getProject',id),saveProject:p=>ipcRenderer.invoke('research:saveProject',p),saveExperiment:p=>ipcRenderer.invoke('research:saveExperiment',p)},
 learning:{listSubjects:()=>ipcRenderer.invoke('learning:listSubjects'),getSubject:id=>ipcRenderer.invoke('learning:getSubject',id),saveSubject:p=>ipcRenderer.invoke('learning:saveSubject',p),saveNote:p=>ipcRenderer.invoke('learning:saveNote',p)},
 search:{query:input=>ipcRenderer.invoke('search:query',input),rebuild:()=>ipcRenderer.invoke('search:rebuild')},
 sources:{resolve:id=>ipcRenderer.invoke('sources:resolve',id),open:id=>ipcRenderer.invoke('sources:open',id)},
 onChange:listener=>{const f=(_event:unknown,change:Parameters<typeof listener>[0])=>listener(change);ipcRenderer.on('archive:change',f);return()=>{ipcRenderer.removeListener('archive:change',f)}}
}
contextBridge.exposeInMainWorld('aia',api)
