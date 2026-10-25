import { useEffect,useState } from 'react'
import type { RecordView } from '../shared/api'
import type { RecordFilter } from '../shared/models'
export function useRecords(filter:RecordFilter={}){const [records,setRecords]=useState<RecordView[]>([]),[error,setError]=useState(''),[revision,setRevision]=useState(0);const key=JSON.stringify(filter);useEffect(()=>window.aia.onChange(()=>setRevision(v=>v+1)),[]);useEffect(()=>{let active=true;window.aia.records.list(JSON.parse(key)).then(v=>{if(active){setRecords(v);setError('')}}).catch(e=>{if(active)setError(String(e))});return()=>{active=false}},[key,revision]);return{records,error,refresh:()=>setRevision(v=>v+1)}}
export const moduleLabels:Record<string,string>={learning:'学习数据',research:'科研实验',sports:'运动计划',diet:'饮食计划',games:'游戏娱乐',development:'开发工作',inbox:'随手记'}
export const kindLabels:Record<string,string>={raw_input:'录入原文',subject:'科目',note:'学习笔记',research_project:'科研课题',experiment:'实验记录',activity:'运动记录',meal:'饮食记录',game:'游戏',play_session:'游玩记录',dev_project:'开发项目',dev_issue:'开发问题',dev_version:'版本记录',plan:'计划',report:'分析报告',advice:'建议',document:'档案资料'}
export const errorText=(e:unknown)=>e instanceof Error?e.message:String(e)
