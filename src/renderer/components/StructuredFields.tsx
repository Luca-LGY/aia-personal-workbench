import type { RecordEnvelope } from '../../shared/schemas'
type Field={key:string;label:string;type?:'number'|'time';options?:[string,string][]}
const fields:Record<string,Field[]>={
 plan:[{key:'time',label:'计划时间',type:'time'},{key:'priority',label:'计划优先级',options:[['low','低优先级'],['normal','普通优先级'],['high','高优先级']]}],
 play_session:[{key:'progress',label:'游玩进展'},{key:'durationMin',label:'游玩时长（分钟）',type:'number'}],
 dev_version:[{key:'version',label:'版本号'},{key:'changes',label:'版本变化说明'}],
 activity:[{key:'sport',label:'运动类型'},{key:'durationMin',label:'运动时长（分钟）',type:'number'},{key:'distanceKm',label:'运动距离（公里）',type:'number'}]
}
export function StructuredFields(p:{record:RecordEnvelope;values:Record<string,unknown>;set:(key:string,value:unknown)=>void}){
 return <div className="form-grid">{(fields[p.record.kind]??[]).map(f=><label key={f.key}>{f.label}{f.options?<select aria-label={f.label} value={String(p.values[f.key]??'')} onChange={e=>p.set(f.key,e.target.value)}>{f.options.map(([v,label])=><option value={v} key={v}>{label}</option>)}</select>:<input aria-label={f.label} type={f.type??'text'} {...(f.type==='number'?{min:0,step:'any'}:{})} value={String(p.values[f.key]??'')} onChange={e=>p.set(f.key,f.type==='number'?(e.target.value===''?null:Number(e.target.value)):e.target.value)}/>}</label>)}</div>
}
