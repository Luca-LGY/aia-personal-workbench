import { localDate } from '../../../shared/schemas'
import { useGarmin, garminStatus, formatStamp } from '../sports/useGarmin'
export function GarminSummary({ now, navigate }: { now: string; navigate: (page: string) => void }) {
  const { overview: o, error } = useGarmin(localDate(new Date(now)))
  return <section aria-label="佳明今日"><h3>佳明今日</h3><p>来源：佳明 MCP · 每日归档</p>{error && <p className="error">{error}</p>}{o && <><p>{garminStatus[o.status]}</p><p>数据日期：{o.metrics.steps.date ?? o.archiveDate ?? '—'}<br/>最近成功采集：{formatStamp(o.lastSuccessAt)}</p>{o.metrics.steps.value !== null && <p>步数 {o.metrics.steps.value}{o.metrics.steps.partial ? '（部分累计）' : ''}</p>}{o.metrics.readiness.value !== null && <p>准备度 {o.metrics.readiness.value} · {o.metrics.readiness.date}{o.metrics.readiness.stale ? '（旧值）' : ''}</p>}{o.status === 'no_data' && <p className="muted">尚未读取到同步归档。</p>}</>}<button className="outline" onClick={() => navigate('sports')}>查看运动详情</button></section>
}
