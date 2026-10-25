import { test,expect } from 'vitest'
import { makeRecord,RecordSchema } from '../../src/shared/schemas'
import { parseDocument,serializeRecord } from '../../src/main/archive/codec'
test('typed meals preserve unknown keys, zero and missing quantities on a Markdown round trip',()=>{
 const r=makeRecord('meal',{title:'早餐',module:'diet',role:'actual',data:{meal:'breakfast',description:'鸡蛋',quantity:null,extra:false},custom:'keep'})
 const p=parseDocument(serializeRecord(r),'meal.md');expect(p.status).toBe('record');if(p.status!=='record')throw Error('not record');expect(p.record.data).toMatchObject({quantity:null,extra:false});expect(p.record.custom).toBe('keep')
 const a=makeRecord('activity',{module:'sports',data:{durationMin:0,distanceKm:0}});expect(RecordSchema.parse(a).data).toMatchObject({durationMin:0})
})
test('facts, plans, templates and references are explicitly different',()=>{const a=makeRecord('note',{role:'template'});expect(a.role).toBe('template');expect(()=>makeRecord('plan',{role:'actual',data:{scheduledDate:'2026-10-26',status:'pending',priority:'normal'}})).toThrow();expect(makeRecord('plan',{role:'plan',data:{scheduledDate:'2026-10-26',status:'pending',priority:'normal'}}).role).toBe('plan')})
test('broken metadata and calendar dates do not silently become factual records',()=>{expect(parseDocument(Buffer.from('---\naia_id: bad\nkind: meal\n---\n原文'),'x.md').status).toBe('invalid');expect(()=>makeRecord('note',{date:'2026-02-30'})).toThrow();expect(parseDocument(Buffer.from('# 说明\n只是资料'),'README.md').status).toBe('document')})
test('experiments require explicit stable experiment number',()=>{expect(()=>makeRecord('experiment',{data:{}})).toThrow();expect(makeRecord('experiment',{module:'research',data:{experimentNo:'EXP-001',status:'planned',parameters:{alpha:0.2}}}).kind).toBe('experiment')})
