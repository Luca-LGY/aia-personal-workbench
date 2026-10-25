import { ipcMain,BrowserWindow,dialog,shell,type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'
import { RecordSchema } from '../shared/schemas'
import { MODULES,KINDS,type RecordFilter } from '../shared/models'
import type { Services } from './services'
import { SearchQuerySchema } from './indexing/query'
import { CapturePreviewSchema } from '../shared/capture'
import { ScheduleSchema } from '../shared/plans'
import { AdoptAdviceSchema } from './reports/training'
import { ConnectionInputSchema } from './connections/settings'
import { atomicWrite } from './archive/transactions'
export function registerIPC(s:Services,options:{captureReplyDelayMs?:number}={}){
 const pending=new Set<Promise<unknown>>();let accepting=true
 const handle=(channel:string,fn:(...args:unknown[])=>unknown)=>ipcMain.handle(channel,(e:IpcMainInvokeEvent,...args:unknown[])=>{if(!BrowserWindow.fromWebContents(e.sender)||e.senderFrame!==e.sender.mainFrame)throw Error('Unauthorized IPC sender');if(!accepting)throw Error('APP正在退出，请稍后重新打开');const work=Promise.resolve().then(()=>fn(...args));pending.add(work);void work.then(()=>pending.delete(work),()=>pending.delete(work));return work})
 const id=z.uuid(),hash=z.string().regex(/^[a-f0-9]{64}$/)
 const save=z.object({record:RecordSchema,expectedHash:hash.nullable()})
 const endpoint=z.enum(['webdav','github'])
 handle('connections:getState',()=>s.connections.getState())
 handle('connections:configure',p=>s.connections.configure(ConnectionInputSchema.parse(p)))
 handle('connections:setEnabled',(i,enabled)=>s.connections.setEnabled(endpoint.parse(i),z.boolean().parse(enabled)))
 handle('connections:test',i=>s.connections.test(endpoint.parse(i)))
 handle('connections:inspect',i=>s.cloud.inspect(endpoint.parse(i)))
 handle('connections:export',()=>s.connections.export())
 handle('connections:exportFile',async()=>{const result=await dialog.showSaveDialog({defaultPath:'AIA-连接设置.json',filters:[{name:'JSON',extensions:['json']}]});if(result.canceled||!result.filePath)return false;await atomicWrite(result.filePath,JSON.stringify(await s.connections.export(),null,2));return true})
 s.connections.onChange(()=>{for(const w of BrowserWindow.getAllWindows())w.webContents.send('connections:change')})
 handle('reports:overview',date=>s.overview.read(z.iso.date().parse(date)))
 handle('reports:buildWeekly',date=>s.weekly.build(z.iso.date().parse(date)))
 handle('reports:training',date=>s.training.propose(z.iso.date().parse(date)))
 handle('reports:adopt',p=>s.training.adopt(AdoptAdviceSchema.parse(p)))
 handle('garmin:overview',date=>s.garmin.readOverview(z.iso.date().parse(date)))
 handle('garmin:activities',range=>s.garmin.readActivities(z.object({from:z.iso.date().optional(),through:z.iso.date().optional()}).parse(range??{})))
 handle('garmin:trainingPlan',date=>s.garmin.readTrainingPlan(z.iso.date().parse(date)))
 handle('sources:recordForPath',async p=>{const path=z.string().parse(p);return(await s.search.list()).find(v=>v.path===path)?.record.id??null})
 handle('development:saveProject',p=>s.development.saveProject(save.parse(p)))
 handle('development:saveIssue',p=>s.development.saveIssue(save.parse(p)))
 handle('development:saveVersion',p=>s.development.saveVersion(save.parse(p)))
 handle('development:openRepo',async i=>{await shell.openExternal(await s.development.repoURL(id.parse(i)))})
 handle('games:saveGame',p=>s.games.saveGame(save.parse(p)))
 handle('games:saveSession',p=>s.games.saveSession(save.parse(p)))
 handle('games:listSessions',i=>s.games.listSessions(id.parse(i)))
 handle('diet:listDay',date=>s.diet.listDay(z.iso.date().parse(date)))
 handle('diet:saveMeal',input=>s.diet.saveMeal(save.parse(input)))
 handle('research:listProjects',()=>s.research.listProjects())
 handle('research:getProject',i=>s.research.getProject(id.parse(i)))
 handle('research:saveProject',input=>s.research.saveProject(save.parse(input)))
 handle('research:saveExperiment',input=>s.research.saveExperiment(save.parse(input)))
 handle('attachments:resolve',i=>s.attachments.resolve(hash.parse(i)))
 handle('attachments:open',async i=>{const error=await shell.openPath(await s.attachments.location(hash.parse(i)));if(error)throw Error(error)})
 handle('learning:listSubjects',()=>s.learning.listSubjects())
 handle('learning:getSubject',i=>s.learning.getSubject(id.parse(i)))
 handle('learning:saveSubject',input=>s.learning.saveSubject(save.parse(input)))
 handle('learning:saveNote',input=>s.learning.saveNote(save.parse(input)))
 handle('records:list',async f=>{const filter=z.object({module:z.enum(MODULES).optional(),kind:z.enum(KINDS).optional(),date:z.iso.date().optional(),role:z.enum(['actual','plan','reference','template','analysis','suggestion']).optional()}).parse(f??{}) as RecordFilter;return s.search.list(filter)})
 handle('records:get',i=>s.search.view(id.parse(i)))
 handle('records:save',input=>s.repository.save(z.object({record:RecordSchema,expectedHash:hash.nullable()}).parse(input)))
 handle('records:remove',(i,h)=>s.repository.remove(id.parse(i),hash.parse(h)))
 handle('records:restore',i=>s.repository.restoreDeleted(id.parse(i)))
 handle('capture:preview',(text,attachments)=>s.capture.preview(z.string().max(100000).parse(text),z.array(z.string()).parse(attachments)))
 handle('capture:commit',async p=>{const result=await s.capture.commit(CapturePreviewSchema.parse(p));if(options.captureReplyDelayMs)await new Promise(resolve=>setTimeout(resolve,options.captureReplyDelayMs));return result})
 handle('capture:undo',i=>s.capture.undo(id.parse(i)))
 handle('plans:schedule',p=>s.plans.schedule(ScheduleSchema.parse(p)))
 handle('plans:update',p=>s.plans.update(save.parse(p)))
 handle('plans:listDay',date=>s.plans.listDay(z.iso.date().parse(date)))
 handle('plans:setStatus',(i,status,h)=>s.plans.setStatus(id.parse(i),z.enum(['pending','done','cancelled']).parse(status),hash.parse(h)))
 handle('plans:reschedule',(i,date,h)=>s.plans.reschedule(id.parse(i),z.iso.date().parse(date),hash.parse(h)))
 handle('drafts:get',k=>s.drafts.load(z.string().regex(/^[\w-]+$/).parse(k)))
 handle('drafts:save',(k,t)=>s.drafts.save(z.string().regex(/^[\w-]+$/).parse(k),z.string().parse(t)))
 handle('attachments:choose',async()=>{const result=await dialog.showOpenDialog({properties:['openFile','multiSelections']});if(result.canceled)return[];return Promise.all(result.filePaths.map(p=>s.attachments.add(p)))})
 handle('search:query',q=>s.search.query(SearchQuerySchema.parse(q)))
 handle('search:rebuild',()=>s.search.rebuild())
 handle('sources:resolve',i=>s.search.resolveSource(id.parse(i)))
 handle('sources:open',async i=>{const source=await s.search.resolveSource(id.parse(i));if(!source.exists)throw Error('原档案不存在');const error=await shell.openPath(source.path);if(error)throw Error(error)})
 s.repository.onChange(c=>{for(const w of BrowserWindow.getAllWindows())w.webContents.send('archive:change',c)})
 return{async drain(){accepting=false;await Promise.allSettled([...pending]);await s.repository.transactions.idle()}}
}
