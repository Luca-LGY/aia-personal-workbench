import { makeRecord, localDate, type RecordEnvelope } from '../../shared/schemas'
import type { CapturePreview } from '../../shared/capture'
function shiftDate(date: string, days: number) { const value = new Date(date + 'T12:00:00Z'); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10) }
export function previewCapture(rawText: string, options: { now: Date; subjects?: RecordEnvelope[]; attachmentIds?: string[] }): CapturePreview {
  if (!rawText.trim()) throw Error('请先写下内容')
  const sourceId = crypto.randomUUID(), today = localDate(options.now), entries: CapturePreview['entries'] = []
  for (const match of rawText.matchAll(/[^；;。\n，,]+/g)) {
    const clause = match[0].trim(); if (!clause) continue
    const start = match.index + match[0].indexOf(clause), end = start + clause.length
    const date = clause.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? shiftDate(today, /明天/.test(clause) ? 1 : /昨天/.test(clause) ? -1 : 0)
    const role = /明天|准备|打算|计划|将要/.test(clause) ? 'plan' : 'actual', negative = /没吃|未吃|没有吃|不吃/.test(clause)
    const uncertain = /可能|好像|大概|也许/.test(clause) || (negative && /吃了/.test(clause)) || (/早餐|午餐|晚餐|早饭|午饭|晚饭/.test(clause) && /跑了|跑步|骑行|游泳/.test(clause))
    let kind: RecordEnvelope['kind'] = 'document', module: RecordEnvelope['module'] = 'inbox', data: Record<string, unknown> = { pending: true }, basis = '暂不能明确分类，保留原话待整理', pending = true
    const meal = /早餐|早饭/.test(clause) ? 'breakfast' : /午餐|午饭/.test(clause) ? 'lunch' : /晚餐|晚饭/.test(clause) ? 'dinner' : /加餐|夜宵/.test(clause) ? 'snack' : null
    if (!uncertain && meal) {
      kind = 'meal'; module = 'diet'; pending = false; basis = '识别明确餐次；日期和计划/否定词按原话保留'
      data = { meal, description: clause, quantity: negative ? null : clause.match(/(?:\d+(?:\.\d+)?|[一二两三四五六七八九十]+)(?:个|只|颗|杯|碗|克|片|份|毫升)/)?.[0] ?? null, consumed: role === 'actual' && !negative }
    } else if (!uncertain && /跑了|跑步|骑行|骑了|游泳|步行|走了|力量训练/.test(clause)) {
      const duration = clause.match(/(\d+(?:\.\d+)?)\s*(分钟|小时)/)
      kind = 'activity'; module = 'sports'; pending = false; basis = '运动词和明确时长；未提及的距离保持空值'
      data = { sport: /跑/.test(clause) ? '跑步' : /骑/.test(clause) ? '骑行' : /游泳/.test(clause) ? '游泳' : /力量/.test(clause) ? '力量训练' : '步行', durationMin: duration ? Number(duration[1]) * (duration[2] === '小时' ? 60 : 1) : null, distanceKm: null }
    } else if (!uncertain && /学了|学习|复习/.test(clause)) {
      const subject = options.subjects?.find(s => s.kind === 'subject' && clause.toLocaleLowerCase().includes(s.title.toLocaleLowerCase()))
      if (subject) { kind = 'note'; module = 'learning'; pending = false; basis = '匹配已有科目，不推算掌握程度或时长'; data = { subjectId: subject.id, durationMin: null } }
      else basis = '学习内容尚未匹配已有科目，待选择分类'
    }
    const record = makeRecord(kind, { module, role, date, title: clause.slice(0, 80), body: clause, data, sourceRefs: [{ recordId: sourceId, start, end, capturedAt: options.now.toISOString() }], attachmentIds: options.attachmentIds ?? [] }, options.now)
    entries.push({ record, start, end, basis: uncertain ? '表达不确定或矛盾，保留原文待整理' : basis, pending })
  }
  if (!entries.length) throw Error('请写下可归档的内容')
  return { sourceId, rawText, createdAt: options.now.toISOString(), attachmentIds: options.attachmentIds ?? [], entries }
}
