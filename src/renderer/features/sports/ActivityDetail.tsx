import { X } from 'lucide-react'
import type { GarminActivity } from '../../../shared/garmin'
import { SourceLink } from '../../components/SourceLink'
export function ActivityDetail({ activity: a, close, open, notify }: { activity: GarminActivity; close: () => void; open: (id: string) => void; notify: (s: string) => void }) {
  return <div className="modal-backdrop"><section className="record-dialog" role="dialog" aria-label={a.name} aria-modal="true"><button className="icon-button close" aria-label="关闭运动详情" onClick={close}><X/></button><p className="eyebrow">佳明活动 · {a.id}</p><h2>{a.name}</h2><p>{a.startTime} · {a.type}</p><div className="metric-grid"><div className="metric-card"><small>实际时长</small><strong>{a.durationMin == null ? '未记录／单位不明' : a.durationMin + ' 分钟'}</strong></div><div className="metric-card"><small>实际距离</small><strong>{a.distanceKm == null ? '未记录／单位不明' : a.distanceKm + ' 公里'}</strong></div></div><SourceLink source={a.source} open={open} notify={notify}/><p className="file-location">来源：{a.source.path}</p></section></div>
}
