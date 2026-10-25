import { test, expect } from 'vitest'
import { previewCapture } from '../../src/main/capture/parser'
import { makeRecord } from '../../src/shared/schemas'

const now = new Date('2026-10-25T10:00:00+08:00')
const preview = (text: string) => previewCapture(text, { now })

test('breakfast is a dated fact without invented quantity or nutrition', () => {
  const p = preview('今天早餐吃了鸡蛋')
  expect(p.rawText).toBe('今天早餐吃了鸡蛋')
  expect(p.entries).toHaveLength(1)
  const r = p.entries[0].record
  expect(r).toMatchObject({ kind: 'meal', module: 'diet', role: 'actual', date: '2026-10-25', data: { meal: 'breakfast', quantity: null, consumed: true } })
  expect(r.data).not.toHaveProperty('calories')
  expect(p.entries[0].basis).toContain('餐次')
})

test('future intention is a plan and negation never counts as eating', () => {
  expect(preview('明天准备早餐吃鸡蛋').entries[0].record).toMatchObject({ role: 'plan', date: '2026-10-26' })
  expect(preview('今天没吃早餐').entries[0].record).toMatchObject({ data: { consumed: false, quantity: null } })
  expect(preview('今天吃了早餐但又没吃早餐').entries[0].pending).toBe(true)
})

test('explicit duration and calendar rollover are preserved', () => {
  expect(preview('昨天跑了30分钟').entries[0].record).toMatchObject({ kind: 'activity', date: '2026-10-24', data: { durationMin: 30 } })
  const p = previewCapture('明天跑步1.5小时', { now: new Date('2026-12-31T23:00:00+08:00') })
  expect(p.entries[0].record).toMatchObject({ role: 'plan', date: '2027-01-01', data: { durationMin: 90 } })
})

test('learning resolves only existing subjects and never invents a subject catalog', () => {
  expect(preview('学了ODE一节').entries[0]).toMatchObject({ pending: true, record: { module: 'inbox' } })
  const subject = makeRecord('subject', { title: 'ODE', module: 'learning' }, now)
  const p = previewCapture('学了ODE一节', { now, subjects: [subject] })
  expect(p.entries[0].record).toMatchObject({ kind: 'note', module: 'learning', data: { subjectId: subject.id, durationMin: null } })
})

test('mixed clauses keep exact source ranges and uncertain statements stay pending', () => {
  const text = '今天早餐吃了两个鸡蛋；昨天跑了30分钟。可能明天研究一下'
  const p = preview(text)
  expect(p.entries).toHaveLength(3)
  for (const entry of p.entries) {
    expect(text.slice(entry.start, entry.end)).toBe(entry.record.body)
    expect(entry.record.sourceRefs[0]).toMatchObject({ recordId: p.sourceId, start: entry.start, end: entry.end })
  }
  expect(p.entries[0].record.data.quantity).toBe('两个')
  expect(p.entries[2].pending).toBe(true)
  expect(p.rawText).toBe(text)
  expect(preview('今天早餐吃了鸡蛋然后跑了30分钟').entries[0].pending).toBe(true)
})
