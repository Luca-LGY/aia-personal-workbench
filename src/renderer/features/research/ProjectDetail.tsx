import { useEffect, useState } from 'react'
import type { RecordView } from '../../../shared/api'
import { errorText } from '../../hooks'
import { ExperimentDetail } from './ExperimentDetail'
export function ProjectDetail(p: { project: RecordView; experiments: RecordView[]; date: string; open: (id: string) => void; notify: (s: string) => void }) {
  const [summary, setSummary] = useState(p.project.record.body), [busy, setBusy] = useState(false)
  useEffect(() => setSummary(p.project.record.body), [p.project.hash])
  async function save() { setBusy(true); try { await window.aia.research.saveProject({ record: { ...p.project.record, body: summary, updatedAt: new Date().toISOString() }, expectedHash: p.project.hash }); p.notify('课题进展已保存。') } catch (e) { p.notify(errorText(e)) } finally { setBusy(false) } }
  return <section className="domain-detail"><div className="section-heading"><h3>{p.project.record.title}</h3><button className="text-button" onClick={() => p.open(p.project.record.id)}>课题档案与来源</button></div><label>进展摘要<textarea aria-label="课题进展摘要" value={summary} onChange={e => setSummary(e.target.value)}/></label><div className="form-actions"><button className="outline" disabled={busy} onClick={save}>保存课题进展</button><p className="muted">本人实验 {p.experiments.length}</p></div><ExperimentDetail projectId={p.project.record.id} experiments={p.experiments} date={p.date} open={p.open} notify={p.notify}/></section>
}
