import { useEffect,useState } from 'react'
import type { DeletedRecord } from '../../../shared/models'
import { errorText } from '../../hooks'
export function DeletedRecords({notify}:{notify:(s:string)=>void}){
 const [items,setItems]=useState<DeletedRecord[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0)
 useEffect(()=>window.aia.onChange(()=>setRevision(v=>v+1)),[])
 useEffect(()=>{let live=true;window.aia.records.deleted().then(rows=>{if(live){setItems(rows);setError('')}}).catch(e=>{if(live)setError(errorText(e))});return()=>{live=false}},[revision])
 async function restore(id:string){setBusy(true);setError('');try{await window.aia.records.restore(id);setRevision(v=>v+1);notify('已恢复到本机；后续同步会核对当前云端差异。')}catch(e){setError(errorText(e))}finally{setBusy(false)}}
 return <section aria-label="已删除记录"><h3>已删除记录</h3><p className="helper">恢复保留原来的档案身份，云端差异仍由统一同步核对。</p>{error&&<p role="alert" className="error">{error}</p>}{!items.length&&<p className="muted">没有待恢复记录。</p>}{items.map(item=><article className="recent-row" key={item.id}><div><strong>{item.title}</strong><small>删除时间：{item.deletedAt}</small><p className="file-location">{item.path}</p>{!item.available&&<p className="error">原内容缺失或无法校验，请从完整备份恢复；删除标记已保留。</p>}</div><button className="outline" aria-label={'恢复：'+item.title} disabled={busy||!item.available} onClick={()=>restore(item.id)}>恢复</button></article>)}</section>
}
