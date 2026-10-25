import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { HomeOverview } from '../../../shared/reports'
import { localDate } from '../../../shared/schemas'
import { TodayPlans } from '../plans/PlansPage'
import { GarminSummary } from './GarminSummary'
import { SourceLink } from '../../components/SourceLink'
import { errorText } from '../../hooks'
export function OverviewRail(p: { now: string; open: (id: string) => void; navigate: (page: string) => void; notify: (s: string) => void }) {
  const date = localDate(new Date(p.now)), [overview, setOverview] = useState<HomeOverview | null>(null), [revision, setRevision] = useState(0), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => window.aia.onChange(() => setRevision(v => v + 1)), [])
  useEffect(() => { let live = true; window.aia.reports.overview(date).then(v => { if (live) { setOverview(v); setError('') } }).catch(e => { if (live) setError(errorText(e)) }); return () => { live = false } }, [date, revision])
  async function save() { setBusy(true); p.notify(''); try { await window.aia.reports.buildWeekly(date); p.notify('周报已保存到本机。'); setRevision(v => v + 1) } catch (e) { p.notify(errorText(e)) } finally { setBusy(false) } }
  return <aside className="overview-rail"><section><div className="section-heading"><h3>今日计划</h3><button className="text-button" onClick={() => p.navigate('plans')}>查看全部<ChevronRight size={13}/></button></div><TodayPlans now={p.now} open={p.open} notify={p.notify}/><button className="text-button" onClick={() => p.navigate('plans')}>添加今日计划</button></section><GarminSummary now={p.now} navigate={p.navigate}/>
    <section aria-label="本周回顾"><h3>本周回顾</h3>{error && <p className="error" role="alert">{error}</p>}{overview && <><p>{overview.weekly.start} 至 {overview.weekly.end}</p><strong>{overview.weekly.actualCount ? overview.weekly.actualCount + ' 条实际记录' : '等待记录'}</strong><p>已知运动时长：{overview.weekly.knownSportMinutes === null ? '未记录' : overview.weekly.knownSportMinutes + ' 分钟'}{overview.weekly.unknownSportDurationCount > 0 ? '；' + overview.weekly.unknownSportDurationCount + ' 条时长未知' : ''}</p><p>计划完成 {overview.weekly.plans.done}/{overview.weekly.plans.total} · 有记录 {overview.weekly.coveredDates.length}/7 天</p><button className="text-button" disabled={busy} onClick={save}>保存本周周报</button>{overview.generatedReportId && <button className="text-button" onClick={() => p.open(overview.generatedReportId!)}>查看本周报告</button>}<small>基础规则汇总，空白日期不代表没有活动。</small>{overview.existingReports.filter(v => v.record.id !== overview.generatedReportId).slice(0, 2).map(v => <button className="text-button" key={v.record.id} onClick={() => p.open(v.record.id)}>已有报告：{v.record.title}</button>)}</>}</section>
    {!!overview?.attention.length && <section aria-label="近期关注"><h3>近期关注</h3>{overview.attention.slice(0, 5).map(a => <article className="attention-item" key={a.id}><strong>{a.title}</strong><p>{a.detail}</p>{a.source ? <SourceLink source={a.source} open={p.open} notify={p.notify}/> : a.target && <button className="text-button" onClick={() => p.navigate(a.target!)}>查看详情</button>}</article>)}</section>}
  </aside>
}
