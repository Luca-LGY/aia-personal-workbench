import { useEffect,useState } from 'react'
import type { HomeOverview } from '../../../shared/reports'
import { localDate } from '../../../shared/schemas'
import { moduleLabels,errorText } from '../../hooks'
export function ModuleHighlights(p:{now:string;open:(id:string)=>void;navigate:(page:string)=>void}){
 const [items,setItems]=useState<HomeOverview['modules']>([]),[error,setError]=useState(''),[revision,setRevision]=useState(0),date=localDate(new Date(p.now))
 useEffect(()=>window.aia.onChange(()=>setRevision(v=>v+1)),[])
 useEffect(()=>{let live=true;window.aia.reports.overview(date).then(v=>{if(live){setItems(v.modules);setError('')}}).catch(e=>{if(live)setError(errorText(e))});return()=>{live=false}},[date,revision])
 return <section className="module-highlights"><h3>各处近况</h3>{error&&<p role="alert" className="error">{error}</p>}<div className="highlight-grid">{items.map(item=><section className="highlight-card" aria-label={'模块摘要：'+moduleLabels[item.module]} key={item.module}><button className="text-button" onClick={()=>p.navigate(item.module)}>{moduleLabels[item.module]}</button><h4>{item.title}</h4><p>{item.detail}</p>{item.reference&&<small>参考资料，尚未记为实际进展</small>}{item.source?.recordId&&<button className="text-button" aria-label={'查看摘要档案：'+moduleLabels[item.module]} onClick={()=>p.open(item.source!.recordId!)}>查看来源档案</button>}</section>)}</div></section>
}
