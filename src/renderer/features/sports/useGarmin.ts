import { useEffect, useState } from 'react'
import type { GarminOverview } from '../../../shared/garmin'
import { errorText } from '../../hooks'
export function useGarmin(date: string) {
  const [overview, setOverview] = useState<GarminOverview | null>(null), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  useEffect(() => window.aia.onChange(() => setRevision(v => v + 1)), [])
  useEffect(() => { let live = true; window.aia.garmin.overview(date).then(v => { if (live) { setOverview(v); setError('') } }).catch(e => { if (live) setError(errorText(e)) }); return () => { live = false } }, [date, revision])
  return { overview, error }
}
export const garminStatus = { no_data: '尚无归档', success: '已有采集结果', partial: '部分数据／覆盖受限', failed: '最近采集失败', unknown: '采集状态未识别' }
export function formatStamp(value: string | null) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d) }
