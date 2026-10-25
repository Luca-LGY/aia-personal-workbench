import { z } from 'zod'
import { MODULES,type RecordKind } from './models'
export function localDate(now=new Date(),timeZone='Asia/Shanghai'){return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
const common={id:z.uuid(),schemaVersion:z.literal(1),module:z.enum(MODULES),role:z.enum(['actual','plan','reference','template','analysis','suggestion']),title:z.string().min(1),date:z.iso.date(),createdAt:z.iso.datetime({offset:true}),updatedAt:z.iso.datetime({offset:true}),body:z.string(),sourceRefs:z.array(z.object({archiveId:z.string().optional(),path:z.string().optional(),recordId:z.string().optional(),heading:z.string().optional(),hash:z.string().optional(),start:z.number().optional(),end:z.number().optional(),capturedAt:z.string().optional()}).passthrough()),attachmentIds:z.array(z.string())}
const data=<T extends z.ZodRawShape>(fields:T)=>z.object(fields).passthrough()
const variant=<K extends string,T extends z.ZodRawShape>(kind:K,fields:T)=>z.object({...common,kind:z.literal(kind),data:data(fields)}).passthrough()
export const RecordSchema=z.discriminatedUnion('kind',[
 variant('raw_input',{}),variant('subject',{nextStep:z.string().optional()}),variant('note',{subjectId:z.string().optional(),chapter:z.string().optional(),questions:z.array(z.string()).optional(),durationMin:z.number().nonnegative().nullable().optional(),nextStep:z.string().optional()}),
 variant('research_project',{summarySource:z.string().optional(),nextStep:z.string().optional()}),variant('experiment',{experimentNo:z.string().min(1),projectId:z.string().optional(),purpose:z.string().optional(),method:z.string().optional(),parameters:z.record(z.string(),z.unknown()).optional(),status:z.enum(['planned','running','completed','blocked']),result:z.string().optional(),conclusion:z.string().optional(),nextStep:z.string().optional(),codeVersion:z.string().optional()}),
 variant('activity',{sport:z.string().optional(),durationMin:z.number().nonnegative().nullable().optional(),distanceKm:z.number().nonnegative().nullable().optional(),garminId:z.string().optional()}),
 variant('meal',{meal:z.enum(['breakfast','lunch','dinner','snack']),description:z.string(),quantity:z.union([z.string(),z.number()]).nullable().optional(),consumed:z.boolean().optional()}),
 variant('game',{status:z.enum(['planned','playing','finished','paused']).optional(),progress:z.string().optional()}),variant('play_session',{gameId:z.string(),durationMin:z.number().nonnegative().nullable().optional(),progress:z.string().optional()}),
 variant('dev_project',{repoUrl:z.string().optional(),goal:z.string().optional(),stage:z.string().optional(),nextStep:z.string().optional()}),variant('dev_issue',{projectId:z.string(),status:z.enum(['open','in_progress','closed']),nextStep:z.string().optional()}),variant('dev_version',{projectId:z.string(),version:z.string(),changes:z.string().optional()}),
 variant('plan',{sourceId:z.string().nullable().optional(),scheduledDate:z.iso.date(),time:z.string().optional(),priority:z.enum(['low','normal','high']),status:z.enum(['pending','done','cancelled'])}).extend({role:z.literal('plan')}),
 variant('report',{weekStart:z.iso.date().optional(),weekEnd:z.iso.date().optional()}).extend({role:z.literal('analysis')}),variant('advice',{basis:z.array(z.string()),adopted:z.boolean().optional()}).extend({role:z.literal('suggestion')}),variant('document',{})
])
export type RecordEnvelope=z.infer<typeof RecordSchema>
export function makeRecord<K extends RecordKind>(kind:K,overrides?:Record<string,unknown>,now?:Date):Extract<RecordEnvelope,{kind:K}>
export function makeRecord(kind:RecordKind,overrides:Record<string,unknown>={},now=new Date()):RecordEnvelope{
 return RecordSchema.parse({id:globalThis.crypto.randomUUID(),schemaVersion:1,module:'inbox',role:kind==='plan'?'plan':kind==='report'?'analysis':kind==='advice'?'suggestion':'actual',title:'未命名记录',date:localDate(now),createdAt:now.toISOString(),updatedAt:now.toISOString(),body:'',sourceRefs:[],attachmentIds:[],data:{},...overrides,kind})
}
