import { createHash } from 'node:crypto'
import { parseDocument as parseYaml,stringify } from 'yaml'
import { RecordSchema,type RecordEnvelope } from '../../shared/schemas'
export const hashBytes=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex')
export type ParseResult={status:'record';record:RecordEnvelope;hash:string}|{status:'document';body:string;role:'reference'|'template';hash:string}|{status:'invalid';body:string;issues:string[];hash:string}
export function parseDocument(bytes:Buffer,path:string):ParseResult{
 const text=bytes.toString('utf8'),hash=hashBytes(bytes),match=text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/)
 const role=/模板|template|README/i.test(path)?'template':'reference'
 if(!match)return text.startsWith('---\n')?{status:'invalid',body:text,issues:['Unterminated frontmatter'],hash}:{status:'document',body:text,role,hash}
 const doc=parseYaml(match[1]);if(doc.errors.length)return{status:'invalid',body:text,issues:doc.errors.map(x=>x.message),hash}
 const meta=doc.toJS() as Record<string,unknown>|null
 if(!meta||!Object.hasOwn(meta,'aia_id'))return{status:'document',body:text,role,hash}
 const {aia_id,...rest}=meta,result=RecordSchema.safeParse({...rest,id:aia_id,body:match[2]})
 if(!result.success)return{status:'invalid',body:text,issues:result.error.issues.map(x=>x.path.join('.')+': '+x.message),hash}
 return {status:'record',record:result.data,hash}
}
export function serializeRecord(input:RecordEnvelope):Buffer{
 const r=RecordSchema.parse(input),{id,body,...meta}=r
 return Buffer.from('---\n'+stringify({aia_id:id,...meta},{lineWidth:0})+'---\n'+body)
}
