import { useEffect,useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { SyncState } from '../../../shared/sync'
import { errorText } from '../../hooks'
export const syncLabels:Record<string,string>={idle:'本机档案',scanning:'正在比较',planning:'正在整理变更',applying:'正在接回本机',publishing:'正在同步',verifying:'正在核对',synced:'已同步',pending:'等待补同步',conflict:'有冲突待处理',suspended:'恢复后暂停发布',setup_required:'待完成档案接入',unauthorized:'需要重新认证',rate_limited:'达到请求限制',incomplete:'目录尚未完整'}
export function useSync(){const[state,setState]=useState<SyncState|null>(null),[error,setError]=useState('');useEffect(()=>{let live=true;const read=()=>window.aia.sync.getState().then(v=>{if(live){setState(v);setError('')}}).catch(e=>{if(live)setError(errorText(e))});void read();const off=window.aia.sync.onChange(()=>{void read()});return()=>{live=false;off()}},[]);return{state,error}}
export function SyncControls(p:{navigate:(page:string)=>void;notify:(s:string)=>void}){
 const {state}=useSync(),[busy,setBusy]=useState(false),working=busy||!!state?.running,successes=Object.values(state?.endpoints??{}).map(e=>e.lastSuccessAt).filter((v):v is string=>!!v).sort()
 async function run(){setBusy(true);try{const next=await window.aia.sync.run();if(next.phase==='idle')p.notify('请在数据与设置中配置并验证云端连接。');else if(next.phase==='setup_required'){p.notify('云端已比较，完成档案接入后才能发布。');p.navigate('settings')}else if(next.warnings.length)p.notify(next.warnings[0])}catch(e){p.notify(errorText(e))}finally{setBusy(false)}}
 return <div className="sync-head"><button className="outline" disabled={working} onClick={run}><RefreshCw size={20}/>{working?'正在同步…':'立即同步'}</button><div className="sync-meta"><span role="status" aria-label="档案同步状态">{working?'正在同步…':syncLabels[state?.phase??'idle']}</span><span>上次成功：{successes.at(-1)?new Date(successes.at(-1)!).toLocaleString('zh-CN'):'—'}</span><button className="text-button" onClick={()=>p.navigate('settings')}>查看变更</button></div></div>
}
