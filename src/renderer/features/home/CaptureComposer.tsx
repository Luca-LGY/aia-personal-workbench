import { useEffect, useRef, useState } from 'react'
import { Paperclip, X, Undo2 } from 'lucide-react'
import type { AttachmentRef, ModuleId } from '../../../shared/models'
import type { CapturePreview } from '../../../shared/capture'
import { errorText, moduleLabels } from '../../hooks'

interface CaptureDraft { text: string; attachments: AttachmentRef[]; preview: CapturePreview | null }
const emptyDraft: CaptureDraft = { text: '', attachments: [], preview: null }
export function CaptureComposer({ notify }: { notify: (s: string) => void }) {
  const [draft, setDraft] = useState<CaptureDraft>(emptyDraft), [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(''), [draftState, setDraftState] = useState(''), [busy, setBusy] = useState(false), [choosing, setChoosing] = useState(false), [lastSource, setLastSource] = useState('')
  const changedByUser=useRef(false)
  const current = useRef(draft); current.current = draft
  useEffect(() => { let alive = true; window.aia.drafts.get('home').then(raw => {
    if (!alive) return
    if (raw) { try { const d = JSON.parse(raw) as CaptureDraft; if (typeof d.text !== 'string' || !Array.isArray(d.attachments)) throw Error(); setDraft(d) } catch { setDraft({ ...emptyDraft, text: raw }) } }
    setLoaded(true)
  }).catch(e => setError(errorText(e))); return () => { alive = false } }, [])
  const attachmentKey = draft.attachments.map(a => a.id).join(',')
  useEffect(() => {
    if (!loaded) return
    if (!draft.text.trim()) { setDraft(d => d.preview ? { ...d, preview: null } : d); return }
    if (current.current.preview?.rawText === draft.text && current.current.preview.attachmentIds.join(',') === attachmentKey) return
    let alive = true
    const timer = setTimeout(() => window.aia.capture.preview(draft.text, current.current.attachments.map(a => a.id)).then(preview => { if (alive) { setDraft(d => ({ ...d, preview })); setError('') } }).catch(e => { if (alive) setError(errorText(e)) }), 180)
    return () => { alive = false; clearTimeout(timer) }
  }, [draft.text, attachmentKey, loaded])
  useEffect(() => {
    if (!loaded || !changedByUser.current) return
    const timer = setTimeout(() => window.aia.drafts.save('home', JSON.stringify(draft)).then(() => setDraftState('草稿已保存到本机')).catch(e => setError(errorText(e))), 120)
    return () => clearTimeout(timer)
  }, [draft, loaded])
  const previewMatches = !!draft.preview && draft.preview.rawText === draft.text && draft.preview.attachmentIds.join(',') === attachmentKey
  function replaceAttachments(d: CaptureDraft, attachments: AttachmentRef[]): CaptureDraft {
    const ids = attachments.map(a => a.id)
    return { ...d, attachments, preview: d.preview ? { ...d.preview, attachmentIds: ids, entries: d.preview.entries.map(e => ({ ...e, record: { ...e.record, attachmentIds: ids } })) } : null }
  }
  async function chooseAttachments() {
    if (busy || choosing) return
    setChoosing(true)
    try { const items = await window.aia.attachments.choose();if(!items.length)return;changedByUser.current=true; setDraft(d => replaceAttachments(d, [...d.attachments, ...items.filter(i => !d.attachments.some(a => a.id === i.id))])) }
    catch (e) { setError(errorText(e)) } finally { setChoosing(false) }
  }
  function updateEntry(index: number, fields: Record<string, unknown>) {
    if (busy || choosing) return
    changedByUser.current=true
    setDraft(d => d.preview ? { ...d, preview: { ...d.preview, entries: d.preview.entries.map((e, i) => {
      if (i !== index) return e
      const record = { ...e.record, ...fields }
      if (fields.module && fields.module !== e.record.module) { record.kind = 'document'; record.data = { pending: false }; e = { ...e, pending: false, basis: '由你选择归属；原话保留' } }
      return { ...e, record }
    }) } } : d)
  }
  async function commit() {
    const p = draft.preview; if (!p || !previewMatches || busy || choosing) return
    setBusy(true); setError('')
    try {
      await window.aia.drafts.save('home', JSON.stringify(draft))
      await window.aia.capture.commit(p)
      setLastSource(p.sourceId); setDraft(emptyDraft)
      await window.aia.drafts.save('home', JSON.stringify(emptyDraft))
      notify('已保存到本机，正在比较云端。')
      const sync=await window.aia.sync.run()
      notify(sync.phase==='synced'?'已保存到本机并完成云端同步。':sync.phase==='idle'?'已保存到本机；云端待连接。':sync.phase==='setup_required'?'已保存到本机；完成档案接入后同步。':'已保存到本机；'+(sync.phase==='conflict'?'有冲突待处理。':'云端待补同步。'))
    } catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  async function undo() { try { await window.aia.capture.undo(lastSource); setLastSource(''); notify('已撤销这次归档，原始版本可恢复。') } catch (e) { setError(errorText(e)) } }
  return <section className="capture-section"><h3>随手记</h3><div className="capture-box"><fieldset className="capture-editors" disabled={busy || choosing}>
    <textarea aria-label="随手记内容" placeholder="写下今天发生的事、想法，或接下来的安排…" value={draft.text} disabled={!loaded || busy} onChange={e => {changedByUser.current=true;setDraft(d => ({ ...d, text: e.target.value }))}}/>
    {!!draft.attachments.length && <div className="attachment-chips">{draft.attachments.map(a => <span key={a.id}>{a.name}<button aria-label={'移除附件' + a.name} onClick={() => {changedByUser.current=true;setDraft(d => replaceAttachments(d, d.attachments.filter(x => x.id !== a.id)))}}><X size={12}/></button></span>)}</div>}
    {draft.preview?.rawText === draft.text ? <div className="capture-items">{draft.preview.entries.map((e, i) => <fieldset key={e.record.id}><legend>事项 {i + 1}{e.pending ? ' · 待整理' : ''}</legend>
      <input aria-label={`事项${i + 1}标题`} value={e.record.title} onChange={v => updateEntry(i, { title: v.target.value })}/>
      <div className="preview-fields"><select aria-label={`事项${i + 1}分类`} value={e.record.module} onChange={v => updateEntry(i, { module: v.target.value as ModuleId })}>{Object.entries(moduleLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <input aria-label={`事项${i + 1}日期`} type="date" value={e.record.date} onChange={v => updateEntry(i, { date: v.target.value })}/>
        <select aria-label={`事项${i + 1}性质`} value={e.record.role} onChange={v => updateEntry(i, { role: v.target.value })}><option value="actual">已发生</option><option value="plan">计划</option><option value="reference">参考</option></select></div><small>{e.basis}</small>
    </fieldset>)}</div> : <div className="capture-preview">写下原话，整理到合适的档案。</div>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="capture-actions"><button className="text-button" onClick={chooseAttachments}><Paperclip size={20}/>添加附件</button>
      <button className="primary" disabled={busy || choosing || !previewMatches} onClick={commit}>{busy ? '正在保存…' : '归档并同步'}</button></div>
  </fieldset></div><div className="capture-helper"><p className="helper">保留原文，可修改或撤销。{draft.text && draftState}</p>{lastSource && <button className="text-button" onClick={undo}><Undo2 size={16}/>撤销本次归档</button>}</div></section>
}
