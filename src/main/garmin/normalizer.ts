import type { GarminOverview, GarminMetric, GarminActivity, GarminWorkout } from '../../shared/garmin'
import type { SourceRef } from '../../shared/models'
export const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
export const rows = (v: unknown) => (Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : []).map(object)
const text = (v: unknown) => typeof v === 'string' ? v : ''
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null
const strings = (v: unknown) => Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []
function pick(v: unknown, date: string) { return rows(v).filter(r => typeof r.date === 'string' && r.date <= date).sort((a, b) => (text(b.date) + text(b.timestamp)).localeCompare(text(a.date) + text(a.timestamp)))[0] ?? {} }
export function normalizeSnapshot(input: unknown, qualityInput: unknown, options: { date: string; path: string; now: Date; hash?: string }): GarminOverview {
  const s = object(input), q = object(qualityInput), source: SourceRef = { path: options.path, ...(options.hash ? { hash: options.hash } : {}) }
  const collectionStatus = text(s.collection_status), unitSystem = text(s.unit_system), metricUnits = unitSystem === 'metric'
  const status: GarminOverview['status'] = /fail|error/i.test(collectionStatus) ? 'failed' : /partial|pending|coverage_limits/i.test(collectionStatus) ? 'partial' : /success|succeeded/i.test(collectionStatus) ? 'success' : Object.keys(s).length ? 'unknown' : 'no_data'
  const current = object(s.current_day_stats), daily = pick([...rows(s.daily_stats), current], options.date), sleep = pick(s.sleep, options.date), ready = pick(s.training_readiness, options.date)
  const resting = pick([...rows(s.resting_heart_rate), ...rows(s.daily_stats), current].filter(r => number(r.resting_heart_rate_bpm) !== null), options.date)
  function metric(row: Record<string, unknown>, key: string, unit: string, collected?: unknown): GarminMetric {
    const date = text(row.date) || null, value = number(row[key])
    return { value, unit, date, collectedAt: text(row.collected_at) || text(collected) || null, partial: row.is_partial === true, stale: date !== options.date, source }
  }
  const metrics: GarminOverview['metrics'] = { steps: metric(daily, 'total_steps', '步'), sleepHours: metric(sleep, 'sleep_hours', '小时'), restingHr: metric(resting, 'resting_heart_rate_bpm', 'bpm'), readiness: metric(ready, 'score', '分', s.training_readiness_collected_at), recoveryHours: metric(ready, 'recovery_time_hours', '小时', s.training_readiness_collected_at) }
  const missing: string[] = []; if (!metricUnits && Object.keys(s).length) missing.push('单位制未识别')
  for (const [key, m] of Object.entries(metrics)) if (m.value === null) missing.push(key)
  const activities: GarminActivity[] = rows(s.activities_in_lookback).filter(a => a.id !== undefined && a.id !== null).map(a => ({ id: String(a.id), name: text(a.name) || '未命名活动', type: text(a.type), date: text(a.start_time).slice(0, 10), startTime: text(a.start_time), durationMin: metricUnits && number(a.duration_seconds) !== null ? Number(a.duration_seconds) / 60 : null, distanceKm: metricUnits && number(a.distance_meters) !== null ? Number(a.distance_meters) / 1000 : null, source }))
  const details = rows(s.coach_workout_details), workouts: GarminWorkout[] = []
  for (const schedule of [...rows(s.coach_schedule), ...rows(s.coach_schedules)]) for (const [index, w] of rows(schedule.workouts).entries()) {
    const date = text(w.date), detail = details.find(d => d.uuid === w.workout_uuid) ?? {}, rest = w.is_rest_day === true
    workouts.push({ id: date + ':' + (text(w.workout_uuid) || (rest ? 'rest' : String(index))), date, name: text(w.name) || (rest ? '休息日' : '未命名课程'), description: text(detail.description), rest, completed: typeof w.completed === 'boolean' ? w.completed : null, durationMin: metricUnits && number(w.estimated_duration_seconds) !== null ? Number(w.estimated_duration_seconds) / 60 : null, collectedAt: text(schedule.collected_at) || null, source })
  }
  const times = Object.values(metrics).map(m => m.value !== null ? m.collectedAt : null).filter((t): t is string => !!t)
  const window = object(s.collection_window)
  if (status === 'success' || status === 'partial') { const completed = text(window.completed_at) || text(s.recorded_at); if (completed) times.push(completed) }
  const lastSuccessAt = times.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null
  const delta = object(s.activity_delta)
  return { requestedDate: options.date, archiveDate: text(s.archive_date) || null, readAt: options.now.toISOString(), lastSuccessAt, status, collectionStatus, unitSystem, metrics, sources: Object.keys(s).length ? [source] : [], quality: [...strings(s.quality_flags), ...strings(q.quality_flags)], missing, coverage: s.coverage ?? q.actual_data_coverage ?? null, newActivityCount: number(delta.new_activity_count ?? delta.new_count), activities, workouts }
}
