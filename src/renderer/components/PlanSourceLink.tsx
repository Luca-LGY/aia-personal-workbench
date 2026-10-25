import { useEffect, useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { errorText } from '../hooks'
export function PlanSourceLink(p: { sourceId: string; title?: string; date: string; notify: (s: string) => void }) {
  const [busy, setBusy] = useState(false)
  return <button className="outline" disabled={busy} onClick={async () => { setBusy(true); try { await window.aia.plans.schedule({ sourceId: p.sourceId, title: p.title, date: p.date }); p.notify('已加入今日计划。') } catch (e) { p.notify(errorText(e)) } finally { setBusy(false) } }}><CalendarPlus size={16}/>加入今日计划</button>
}
export function PlanOrigin({ id, open }: { id: string; open: (id: string) => void }) {
  const [exists, setExists] = useState<boolean | null>(null)
  useEffect(() => { let live = true; window.aia.records.get(id).then(v => { if (live) setExists(!!v) }).catch(() => { if (live) setExists(false) }); return () => { live = false } }, [id])
  return exists ? <button className="text-button" onClick={() => open(id)}>查看来源档案</button> : <small>{exists === false ? '来源已删除或移动，计划仍保留' : '正在核对来源…'}</small>
}
