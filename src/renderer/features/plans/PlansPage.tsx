import { useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import type { RecordView } from '../../../shared/api'
import { localDate } from '../../../shared/schemas'
import { useRecords, errorText, moduleLabels } from '../../hooks'
import { PlanOrigin } from '../../components/PlanSourceLink'
export function PlanRow({ view, open, notify, compact = false }: { view: RecordView; open: (id: string) => void; notify: (s: string) => void; compact?: boolean }) {
  const r = view.record, [date, setDate] = useState(r.date), [busy, setBusy] = useState(false)
  if (r.kind !== 'plan') return null
  const done = r.data.status === 'done'
  async function action(work: () => Promise<unknown>) { setBusy(true); try { await work() } catch (e) { notify(errorText(e)) } finally { setBusy(false) } }
  return <article className={'plan-row' + (done ? ' is-done' : '')} data-record-id={r.id}>
    <button className="plan-check" aria-label={(done ? '撤销完成：' : '完成计划：') + r.title} disabled={busy} onClick={() => action(() => window.aia.plans.setStatus(r.id, done ? 'pending' : 'done', view.hash))}>{done ? <Check size={19}/> : <span/>}</button>
    <div className="plan-content"><button className="plan-title" onClick={() => open(r.id)}>{r.title}</button><small>{r.data.time ?? '时间未定'} · {r.data.priority === 'high' ? '高优先级' : r.data.priority === 'low' ? '低优先级' : '普通'} · {moduleLabels[r.module]}{done ? ' · 已完成' : ''}</small>
      {!compact && <><div>{r.data.sourceId ? <PlanOrigin id={r.data.sourceId} open={open}/> : <small>独立待办</small>}</div><div className="reschedule"><input type="date" aria-label={'调整日期：' + r.title} value={date} onChange={e => setDate(e.target.value)}/><button className="text-button" disabled={busy || date === r.date} aria-label={'延期：' + r.title} onClick={() => action(() => window.aia.plans.reschedule(r.id, date, view.hash))}><RotateCcw size={15}/>调整日期</button><button className="text-button danger" disabled={busy} onClick={() => action(() => window.aia.records.remove(r.id, view.hash))}>删除计划</button></div></>}
    </div></article>
}
export function TodayPlans(p: { now: string; open: (id: string) => void; notify: (s: string) => void }) {
  const { records } = useRecords({ kind: 'plan', date: localDate(new Date(p.now)) })
  const visible = records.filter(v => v.record.data.status !== 'cancelled')
  return visible.length ? <div>{visible.slice(0, 6).map(v => <PlanRow key={v.record.id} view={v} compact open={p.open} notify={p.notify}/>)}</div> : <p className="empty-inline">今天还没有安排</p>
}
export function PlansPage(p: { now: string; open: (id: string) => void; notify: (s: string) => void }) {
  const [date, setDate] = useState(localDate(new Date(p.now))), [title, setTitle] = useState(''), [time, setTime] = useState(''), [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal'), [busy, setBusy] = useState(false)
  const { records, error } = useRecords({ kind: 'plan', date })
  async function add() { setBusy(true); try { await window.aia.plans.schedule({ title, date, ...(time ? { time } : {}), priority }); setTitle('') } catch (e) { p.notify(errorText(e)) } finally { setBusy(false) } }
  return <section className="page"><div className="page-title"><h2>今日计划</h2><p>安排下一步，完成后保留来源和记录。</p></div><div className="filters"><label>查看日期<input type="date" aria-label="查看日期" value={date} onChange={e => setDate(e.target.value)}/></label></div>
    <form className="plan-form" onSubmit={e => { e.preventDefault(); void add() }}><input aria-label="计划内容" placeholder="添加一件要做的事…" required value={title} onChange={e => setTitle(e.target.value)}/><input type="time" aria-label="计划时间" value={time} onChange={e => setTime(e.target.value)}/><select aria-label="计划优先级" value={priority} onChange={e => setPriority(e.target.value as typeof priority)}><option value="low">低优先级</option><option value="normal">普通优先级</option><option value="high">高优先级</option></select><button className="primary" disabled={busy || !title.trim()}>添加计划</button></form>
    {error && <p role="alert" className="error">{error}</p>}<div className="plan-list">{records.filter(v => v.record.data.status !== 'cancelled').map(v => <PlanRow key={v.record.id} view={v} open={p.open} notify={p.notify}/>)}</div>{!records.length && <p className="empty-inline">这一天还没有计划。也可以从各模块的下一步加入。</p>}
  </section>
}
