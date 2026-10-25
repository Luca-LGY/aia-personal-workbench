import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { makeRecord, localDate } from '../../../shared/schemas'
import { useRecords, errorText } from '../../hooks'
import { SubjectDetail } from './SubjectDetail'
export function LearningPage(p: { now: string; open: (id: string) => void; notify: (s: string) => void }) {
  const { records, error } = useRecords({ module: 'learning' }), [name, setName] = useState(''), [active, setActive] = useState(''), [busy, setBusy] = useState(false)
  const subjects = records.filter(v => v.record.kind === 'subject'), selected = subjects.find(v => v.record.id === active), notes = records.filter(v => v.record.kind === 'note' && v.record.data.subjectId === active)
  async function add() { setBusy(true); try { const r = await window.aia.learning.saveSubject({ record: makeRecord('subject', { title: name, module: 'learning', data: {} }), expectedHash: null }); setActive(r.id); setName('') } catch (e) { p.notify(errorText(e)) } finally { setBusy(false) } }
  return <section className="page"><div className="page-title"><h2>学习数据</h2><p>按自己的科目整理笔记、材料和疑问。以后可沿用 Obsidian 分类。</p></div><form className="inline-form" onSubmit={e => { e.preventDefault(); void add() }}><input aria-label="新科目名称" placeholder="你的科目名称" required value={name} onChange={e => setName(e.target.value)}/><button className="primary" disabled={busy || !name.trim()}>创建科目</button></form>{error && <p role="alert">{error}</p>}<div className="domain-layout"><aside className="entity-list">{subjects.map(v => <button key={v.record.id} aria-label={'科目：' + v.record.title} aria-current={active === v.record.id ? 'true' : undefined} onClick={() => setActive(v.record.id)}><BookOpen size={19}/><span>{v.record.title}<small>{records.filter(n => n.record.kind === 'note' && n.record.data.subjectId === v.record.id).length} 条笔记</small></span></button>)}{!subjects.length && <p className="empty-inline">还没有科目，从你实际的分类开始。</p>}</aside>{selected ? <SubjectDetail key={selected.record.id} subject={selected} notes={notes} date={localDate(new Date(p.now))} open={p.open} notify={p.notify}/> : <div className="empty-state">选择科目查看内容，或创建第一个科目。</div>}</div>
    {records.some(v => v.record.kind === 'document' || (v.record.kind === 'note' && !v.record.data.subjectId)) && <section className="legacy-section"><h3>资料与待归类笔记</h3>{records.filter(v => v.record.kind === 'document' || (v.record.kind === 'note' && !v.record.data.subjectId)).map(v => <button className="text-button" key={v.record.id} onClick={() => p.open(v.record.id)}>{v.record.title}</button>)}</section>}
  </section>
}
