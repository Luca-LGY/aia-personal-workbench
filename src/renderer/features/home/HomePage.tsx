import { OverviewRail } from './OverviewRail'
import { CaptureComposer } from './CaptureComposer'
import { FileText,ArrowRight } from 'lucide-react'
import { useRecords,moduleLabels } from '../../hooks'
export function HomePage(p:{now:string;open:(id:string)=>void;navigate:(page:string)=>void;notify:(s:string)=>void}){
 const {records,error}=useRecords()
 const recent=records.filter(v=>v.record.role!=='template'&&v.record.kind!=='raw_input').slice(0,5)
 const date=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'short'}).format(new Date(p.now))
 return <div className="home-grid"><section className="home-main"><div className="home-title"><h2>记下此刻，继续今天</h2><p>{date}</p></div><CaptureComposer notify={p.notify}/><section className="recent-section"><h3>最近归档</h3>{error&&<p role="alert" className="error">{error}</p>}{recent.map(v=><button className="recent-row" key={v.record.id} aria-label={'打开档案：'+v.record.title} onClick={()=>p.open(v.record.id)}><FileText size={30}/><div><strong>{v.record.title}</strong><small>{moduleLabels[v.record.module]} · {v.record.date}</small></div><span>查看原档案</span><ArrowRight size={18}/></button>)}{!recent.length&&<p className="empty-inline">还没有归档记录。从上方记下第一件事。</p>}</section></section><OverviewRail now={p.now} open={p.open} navigate={p.navigate} notify={p.notify}/></div>
}
