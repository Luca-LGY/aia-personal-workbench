import { test, expect } from 'vitest'
import daily from '../fixtures/garmin/daily.json'
import { normalizeSnapshot } from '../../src/main/garmin/normalizer'
const options = { date: '2026-10-25', path: '运动/数据/2026-10-25/佳明快照.json', now: new Date('2026-10-25T12:00:00+08:00') }
test('business date, collection time, partial current day and older readiness stay distinct', () => {
  const r = normalizeSnapshot(daily, {}, options)
  expect(r.metrics.steps).toMatchObject({ value: 1234, date: '2026-10-25', partial: true, stale: false })
  expect(r.metrics.readiness).toMatchObject({ value: 65, date: '2026-10-24', stale: true, collectedAt: '2026-10-24T09:05:00+08:00' })
  expect(r.readAt).not.toBe(r.lastSuccessAt)
  expect(r.newActivityCount).toBe(0)
  expect(r.activities[0]).toMatchObject({ id: '9001', durationMin: 30, distanceKm: 5 })
})
test('failed requests retain dated old values and missing fields stay null', () => {
  const r = normalizeSnapshot({ ...daily, collection_status: 'failed', current_day_stats: null, sleep: [], training_readiness: [] }, { quality_flags: ['本次失败，保留旧有效值'] }, options)
  expect(r.status).toBe('failed')
  expect(r.metrics.steps).toMatchObject({ value: 6000, date: '2026-10-24', stale: true })
  expect(r.metrics.sleepHours.value).toBeNull()
  expect(r.metrics.readiness.value).toBeNull()
  expect(r.lastSuccessAt).not.toBe(options.now.toISOString())
  expect(r.quality).toContain('本次失败，保留旧有效值')
})
test('unknown units do not guess conversions or treat an empty lookback as zero new activities', () => {
  const r = normalizeSnapshot({ ...daily, unit_system: 'unknown', activity_delta: {} }, {}, options)
  expect(r.activities[0].durationMin).toBeNull(); expect(r.activities[0].distanceKm).toBeNull()
  expect(r.newActivityCount).toBeNull()
  expect(r.missing).toContain('单位制未识别')
})
test('weekly field aliases and returned workout dates are respected', () => {
  const r = normalizeSnapshot({ ...daily, recorded_at: undefined, collection_status: 'all_36_read_requests_succeeded_with_documented_coverage_limits', coach_schedule: undefined, coach_schedules: [{ requested_calendar_date: '2026-10-25', collected_at: '2026-10-25T08:00:00+08:00', workouts: [{ date: '2026-10-26', is_rest_day: true }] }] }, {}, options)
  expect(r.status).toBe('partial')
  expect(r.workouts[0]).toMatchObject({ date: '2026-10-26', rest: true, durationMin: null })
  expect(r.lastSuccessAt).toBe('2026-10-25T08:00:00+08:00')
})
