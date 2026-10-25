import { ExternalLink } from 'lucide-react'
import type { SourceRef } from '../../shared/models'
import { errorText } from '../hooks'
export function SourceLink({ source, open, notify }: { source: SourceRef; open: (id: string) => void; notify: (s: string) => void }) {
  async function show() { try { const id = source.recordId ?? (source.path ? await window.aia.sources.recordForPath(source.path) : null); if (!id) throw Error('来源档案暂不可定位，请重新建立索引。'); open(id) } catch (e) { notify(errorText(e)) } }
  return <button className="text-button" onClick={show}><ExternalLink size={14}/>查看来源档案</button>
}
