import type { HomeOverview } from '../../shared/reports'
import type { SearchService } from '../indexing/search'
import type { WeeklyReportService } from './weekly'
import type { GarminArchiveReader } from '../garmin/reader'
export class OverviewService {
  constructor(private weekly: WeeklyReportService, private search: SearchService, private garmin: GarminArchiveReader) {}
  async read(date: string): Promise<HomeOverview> {
    const [weekly, views, garmin] = await Promise.all([this.weekly.read(date), this.search.list(), this.garmin.readOverview(date)]), attention: HomeOverview['attention'] = []
    for (const v of views) {
      const r = v.record, source = { recordId: r.id, path: v.path, hash: v.hash, heading: r.title }
      if (r.kind === 'plan' && r.data.status === 'pending' && r.data.scheduledDate < date) attention.push({ id: r.id, title: '计划待处理：' + r.title, detail: '原安排 ' + r.data.scheduledDate, source })
      if (r.kind === 'document' && r.data.pending === true) attention.push({ id: r.id, title: '待整理：' + r.title, detail: '保留了原话，请选择归属或补充信息。', source })
      if (r.data.issue) attention.push({ id: r.id + ':issue', title: '档案元数据需要核对', detail: r.title + ' · ' + String(r.data.issue), source })
    }
    if (garmin.status === 'failed') attention.push({ id: 'garmin-failed', title: '佳明最近采集失败', detail: '已有有效值继续保留，请查看来源日期与缺项。', target: 'sports' })
    if (garmin.metrics.readiness.value !== null && garmin.metrics.readiness.stale) attention.push({ id: 'garmin-stale', title: '准备度是旧日期的值', detail: '数据日期 ' + garmin.metrics.readiness.date + '，不据此推算今日训练强度。', target: 'sports' })
    const existingReports = views.filter(v => v.record.kind === 'report' || (v.record.kind === 'document' && /周报|周度复盘/.test(v.path)))
    return { weekly, attention, existingReports, generatedReportId: existingReports.find(v => v.record.data.generatedBy === 'basic-rules-v1' && v.record.data.weekStart === weekly.start)?.record.id ?? null }
  }
}
