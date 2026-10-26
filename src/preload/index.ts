import { contextBridge,ipcRenderer } from 'electron'
import type { AiaAPI } from '../shared/api'
const api:AiaAPI={
 runtime:()=>ipcRenderer.invoke('aia:runtime'),
 sync:{getState:()=>ipcRenderer.invoke('sync:getState'),run:()=>ipcRenderer.invoke('sync:run'),candidate:(id,node)=>ipcRenderer.invoke('sync:candidate',id,node),resolve:p=>ipcRenderer.invoke('sync:resolve',p),onChange:listener=>{const f=()=>listener();ipcRenderer.on('sync:change',f);return()=>{ipcRenderer.removeListener('sync:change',f)}}},
 onWake:listener=>{const f=()=>listener();ipcRenderer.on('aia:wake',f);return()=>{ipcRenderer.removeListener('aia:wake',f)}},
 connections:{getState:()=>ipcRenderer.invoke('connections:getState'),configure:p=>ipcRenderer.invoke('connections:configure',p),setEnabled:(id,enabled)=>ipcRenderer.invoke('connections:setEnabled',id,enabled),test:id=>ipcRenderer.invoke('connections:test',id),inspect:id=>ipcRenderer.invoke('connections:inspect',id),export:()=>ipcRenderer.invoke('connections:export'),exportFile:()=>ipcRenderer.invoke('connections:exportFile'),onChange:listener=>{const f=()=>listener();ipcRenderer.on('connections:change',f);return()=>{ipcRenderer.removeListener('connections:change',f)}}},
 reports:{overview:date=>ipcRenderer.invoke('reports:overview',date),buildWeekly:date=>ipcRenderer.invoke('reports:buildWeekly',date),training:date=>ipcRenderer.invoke('reports:training',date),adopt:p=>ipcRenderer.invoke('reports:adopt',p)},
 records:{list:filter=>ipcRenderer.invoke('records:list',filter),get:id=>ipcRenderer.invoke('records:get',id),save:input=>ipcRenderer.invoke('records:save',input),remove:(id,hash)=>ipcRenderer.invoke('records:remove',id,hash),restore:id=>ipcRenderer.invoke('records:restore',id)},
 drafts:{get:key=>ipcRenderer.invoke('drafts:get',key),save:(key,text)=>ipcRenderer.invoke('drafts:save',key,text)},
 attachments:{choose:()=>ipcRenderer.invoke('attachments:choose'),resolve:id=>ipcRenderer.invoke('attachments:resolve',id),open:id=>ipcRenderer.invoke('attachments:open',id)},
 capture:{preview:(text,attachmentIds)=>ipcRenderer.invoke('capture:preview',text,attachmentIds),commit:p=>ipcRenderer.invoke('capture:commit',p),undo:id=>ipcRenderer.invoke('capture:undo',id)},
 plans:{update:p=>ipcRenderer.invoke('plans:update',p),schedule:p=>ipcRenderer.invoke('plans:schedule',p),listDay:date=>ipcRenderer.invoke('plans:listDay',date),setStatus:(id,status,hash)=>ipcRenderer.invoke('plans:setStatus',id,status,hash),reschedule:(id,date,hash)=>ipcRenderer.invoke('plans:reschedule',id,date,hash)},
 garmin:{overview:date=>ipcRenderer.invoke('garmin:overview',date),activities:range=>ipcRenderer.invoke('garmin:activities',range),trainingPlan:date=>ipcRenderer.invoke('garmin:trainingPlan',date)},
 development:{saveProject:p=>ipcRenderer.invoke('development:saveProject',p),saveIssue:p=>ipcRenderer.invoke('development:saveIssue',p),saveVersion:p=>ipcRenderer.invoke('development:saveVersion',p),openRepo:id=>ipcRenderer.invoke('development:openRepo',id)},
 games:{saveGame:p=>ipcRenderer.invoke('games:saveGame',p),saveSession:p=>ipcRenderer.invoke('games:saveSession',p),listSessions:id=>ipcRenderer.invoke('games:listSessions',id)},
 diet:{listDay:date=>ipcRenderer.invoke('diet:listDay',date),saveMeal:p=>ipcRenderer.invoke('diet:saveMeal',p)},
 research:{listProjects:()=>ipcRenderer.invoke('research:listProjects'),getProject:id=>ipcRenderer.invoke('research:getProject',id),saveProject:p=>ipcRenderer.invoke('research:saveProject',p),saveExperiment:p=>ipcRenderer.invoke('research:saveExperiment',p)},
 learning:{listSubjects:()=>ipcRenderer.invoke('learning:listSubjects'),getSubject:id=>ipcRenderer.invoke('learning:getSubject',id),saveSubject:p=>ipcRenderer.invoke('learning:saveSubject',p),saveNote:p=>ipcRenderer.invoke('learning:saveNote',p)},
 search:{query:input=>ipcRenderer.invoke('search:query',input),rebuild:()=>ipcRenderer.invoke('search:rebuild')},
 sources:{recordForPath:path=>ipcRenderer.invoke('sources:recordForPath',path),resolve:id=>ipcRenderer.invoke('sources:resolve',id),open:id=>ipcRenderer.invoke('sources:open',id)},
 onChange:listener=>{const f=(_event:unknown,change:Parameters<typeof listener>[0])=>listener(change);ipcRenderer.on('archive:change',f);return()=>{ipcRenderer.removeListener('archive:change',f)}}
}
contextBridge.exposeInMainWorld('aia',api)
