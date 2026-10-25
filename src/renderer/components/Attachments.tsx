import { useEffect, useState } from 'react'
import { Paperclip } from 'lucide-react'
import type { AttachmentRef } from '../../shared/models'
import { errorText } from '../hooks'
export function Attachments({ ids, notify }: { ids: string[]; notify: (s: string) => void }) {
  const [refs, setRefs] = useState<{ id: string; value: AttachmentRef | null; error?: string }[]>([]), key = ids.join(',')
  useEffect(() => { let live = true; Promise.all(key.split(',').filter(Boolean).map(async id => { try { return { id, value: await window.aia.attachments.resolve(id) } } catch (e) { return { id, value: null, error: errorText(e) } } })).then(v => { if (live) setRefs(v) }); return () => { live = false } }, [key])
  return refs.length ? <section className="attachment-list"><h4>附件</h4>{refs.map(r => r.value ? <button className="text-button" key={r.id} aria-label={'打开附件：' + r.value.name} onClick={() => window.aia.attachments.open(r.id).catch(e => notify(errorText(e)))}><Paperclip size={16}/>{r.value.name}</button> : <p key={r.id} className="muted">{r.error ?? '附件暂不可用'}（{r.id.slice(0, 8)}）</p>)}</section> : null
}
