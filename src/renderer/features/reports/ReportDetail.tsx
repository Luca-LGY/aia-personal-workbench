import type { RecordEnvelope } from '../../../shared/schemas'
export function ReportDetail({ record }: { record: RecordEnvelope }) {
  return <div className="report-content"><p className="eyebrow">基础规则周报 · {String(record.data.weekStart ?? record.date)} 至 {String(record.data.weekEnd ?? '')}</p><div className="record-body">{record.body}</div><p className="muted">来源列在下方，可以打开对应档案核对。</p></div>
}
