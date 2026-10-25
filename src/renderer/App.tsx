import { useEffect,useState } from 'react'
import { AppShell,NAV } from './components/AppShell'
import { GamesPage } from './features/games/GamesPage'
import { DietPage } from './features/diet/DietPage'
import { ResearchPage } from './features/research/ResearchPage'
import { LearningPage } from './features/learning/LearningPage'
import { PlansPage } from './features/plans/PlansPage'
import { HomePage } from './features/home/HomePage'
import { SearchPage } from './features/search/SearchPage'
import { RecordDetail } from './components/RecordDetail'
import { errorText } from './hooks'
function readRoute(){const [path,params='']=(window.location.hash.slice(1)||'/').split('?');const q=new URLSearchParams(params);return{page:path==='/'?'home':path.slice(1),query:q.get('q'),record:q.get('record')}}
export function App(){
 const [route,setRoute]=useState(readRoute),[query,setQuery]=useState(()=>readRoute().query??''),[message,setMessage]=useState(''),[now,setNow]=useState(new Date().toISOString())
 useEffect(()=>{const f=()=>setRoute(readRoute());window.addEventListener('hashchange',f);window.aia.runtime().then(r=>setNow(r.now)).catch(e=>setMessage(errorText(e)));return()=>window.removeEventListener('hashchange',f)},[])
 useEffect(()=>{if(route.query!==null)setQuery(route.query)},[route.query])
 function navigate(page:string,record?:string){const q=new URLSearchParams();if(page==='search'&&query)q.set('q',query);if(record)q.set('record',record);window.location.hash=(page==='home'?'/':'/'+page)+(q.size?'?'+q:'')}
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();document.querySelector<HTMLInputElement>('[aria-label="全局关键词搜索"]')?.focus()}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[])
 const label=NAV.find(x=>x[0]===route.page)?.[1]??'首页总览'
 return <><AppShell page={route.page} query={query} setQuery={setQuery} navigate={navigate} notify={setMessage}>{route.page==='home'?<HomePage now={now} open={id=>navigate(route.page,id)} navigate={navigate} notify={setMessage}/>:route.page==='games'?<GamesPage now={now} open={id=>navigate(route.page,id)} notify={setMessage}/>:route.page==='diet'?<DietPage now={now} open={id=>navigate(route.page,id)} notify={setMessage}/>:route.page==='research'?<ResearchPage now={now} open={id=>navigate(route.page,id)} notify={setMessage}/>:route.page==='learning'?<LearningPage now={now} open={id=>navigate(route.page,id)} notify={setMessage}/>:route.page==='plans'?<PlansPage now={now} open={id=>navigate(route.page,id)} notify={setMessage}/>:route.page==='search'?<SearchPage query={query} open={id=>navigate(route.page,id)}/>:<section className="page"><div className="page-title"><h2>{label}</h2><p>按你的节奏，整理这里的内容。</p></div><div className="empty-state"><p>模块功能正在接入</p><small>本机档案与全局搜索已经可用。</small></div></section>}</AppShell>{message&&<div className="toast" role="status"><span>{message}</span><button aria-label="关闭提示" onClick={()=>setMessage('')}>关闭</button></div>}{route.record&&<RecordDetail id={route.record} query={query} onClose={()=>navigate(route.page)} notify={setMessage}/>}</>
}
