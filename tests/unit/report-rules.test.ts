import { test, expect } from 'vitest'
import { makeRecord, localDate } from '../../src/shared/schemas'
import { weekBounds, summarizeWeek } from '../../src/main/reports/weekly'
import { proposeTraining } from '../../src/main/reports/training'
import { normalizeSnapshot } from '../../src/main/garmin/normalizer'
import daily from '../fixtures/garmin/daily.json'
test('natural week follows Shanghai Monday through Sunday at UTC boundary', () => {
  expect(weekBounds('2026-10-25')).toEqual({ start: '2026-10-19', end: '2026-10-25' })
  expect(weekBounds(localDate(new Date('2026-10-25T17:00:00Z')))).toEqual({ start: '2026-10-26', end: '2026-11-01' })
})
test('only actual records count, IDs deduplicate, unknown time is not invented, and source links remain', () => {
  const note = makeRecord('note', { title: '实际笔记', module: 'learning', date: '2026-10-25' })
  const template = makeRecord('note', { role: 'template', date: '2026-10-25' })
  const reference = makeRecord('document', { role: 'reference', module: 'research', date: '2026-10-25' })
  const plan = makeRecord('plan', { date: '2026-10-25', data: { scheduledDate: '2026-10-25', priority: 'normal', status: 'done' } })
  const unknown = makeRecord('activity', { module: 'sports', date: '2026-10-24', data: { durationMin: null } })
  const skippedMeal = makeRecord('meal', { module: 'diet', date: '2026-10-25', data: { meal: 'breakfast', description: '没吃', consumed: false } })
  const r = summarizeWeek([note, note, template, reference, plan, unknown, skippedMeal], [], '2026-10-25')
  expect(r.actualCount).toBe(2); expect(r.plans).toEqual({ total: 1, done: 1, pending: 0 })
  expect(r.knownSportMinutes).toBeNull(); expect(r.unknownSportDurationCount).toBe(1)
  expect(r.coveredDates).toEqual(['2026-10-24', '2026-10-25'])
  expect(r.sources.some(s => s.recordId === note.id)).toBe(true)
  expect(r.sources.some(s => s.recordId === template.id || s.recordId === reference.id)).toBe(false)
})
test('Garmin and manual import of same activity ID do not count twice', () => {
  const overview = normalizeSnapshot(daily, {}, { date: '2026-10-25', path: '运动/数据/2026-10-25/佳明快照.json', now: new Date() })
  const duplicate = makeRecord('activity', { module: 'sports', date: '2026-10-24', data: { garminId: '9001', durationMin: 30 } })
  const r = summarizeWeek([duplicate], [...overview.activities, ...overview.activities], '2026-10-25')
  expect(r.sportCount).toBe(1); expect(r.knownSportMinutes).toBe(30)
})
test('training choices explain original, defer, skip and custom time without inventing intensity', () => {
  const o = normalizeSnapshot(daily, {}, { date: '2026-10-25', path: '运动/数据/2026-10-25/佳明快照.json', now: new Date() })
  o.workouts.push({ ...o.workouts[0], id: 'old-session', date: '2026-10-24', completed: false })
  const choices = proposeTraining(o, '2026-10-25')
  expect(new Set(choices.map(p => p.action))).toEqual(new Set(['original', 'defer', 'skip', 'custom']))
  expect(choices.every(p => p.basis.length > 0 && p.source.path)).toBe(true)
  expect(choices.some(p => p.limitations.includes('准备度日期较旧，不据此推算训练强度'))).toBe(true)
})
