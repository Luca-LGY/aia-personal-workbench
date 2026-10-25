import { ipcMain,BrowserWindow,dialog,shell,type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'
import { RecordSchema } from '../shared/schemas'
import { MODULES,KINDS,type RecordFilter } from '../shared/models'
import type { Services } from './services'
import { SearchQuerySchema } from './indexing/query'
import { CapturePreviewSchema } from '../shared/capture'
import { ScheduleSchema } from '../shared/plans'
export function registerIPC(s:Services){
 const handle=(channel:string,fn:(...args:unknown[])=>unknown)=>ipcMain.handle(channel,(e:IpcMainInvokeEvent,...args:unknown[])=>{if(!BrowserWindow.fromWebContents(e.sender)||e.senderFrame!==e.sender.mainFrame)throw Error('Unauthorized IPC sender');return fn(...args)})
 const id=z.uuid(),hash=z.string().regex(/^[a-f0-9]{64}$/)
 const save=z.object({record:RecordSchema,expectedHash:hash.nullable()})
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
 handle('capture:commit',p=>s.capture.commit(CapturePreviewSchema.parse(p)))
 handle('capture:undo',i=>s.capture.undo(id.parse(i)))
 handle('plans:schedule',p=>s.plans.schedule(ScheduleSchema.parse(p)))
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
}
