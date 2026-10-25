import { test, expect } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import daily from '../fixtures/garmin/daily.json'
import { GarminArchiveReader } from '../../src/main/garmin/reader'
test('full Markdown history survives lookback merge, repeated IDs deduplicate and source files stay unchanged', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aia-garmin-')); try {
    const dir = join(root, '运动/数据/2026-10-25'); await mkdir(dir, { recursive: true })
    const bytes = JSON.stringify(daily); await writeFile(join(dir, '佳明快照.json'), bytes)
    await writeFile(join(root, '运动/活动记录.md'), '| 当地日期时间 | 类型 | 活动名 | km | 分钟 | 活动 ID |\n| --- | --- | --- | --- | --- | --- |\n| 2026-09-01 07:00 | running | 历史活动 | 3 | 20 | `8000` |\n| 2026-10-24 07:00 | running | 旧名称 | 4 | 28 | `9001` |\n')
    await writeFile(join(dir, '来源与质量.json'), JSON.stringify({ quality_flags: ['合成质量提示'] }))
    const reader = new GarminArchiveReader(root), overview = await reader.readOverview('2026-10-25')
    expect(overview.activities).toHaveLength(2)
    expect(overview.activities.find(a => a.id === '9001')).toMatchObject({ name: '合成晨跑', distanceKm: 5 })
    expect(overview.activities.find(a => a.id === '8000')).toMatchObject({ name: '历史活动', durationMin: 20 })
    expect(overview.quality).toContain('合成质量提示')
    await writeFile(join(dir, '周度复盘快照_broken.json'), '{bad')
    const after = await reader.readOverview('2026-10-25')
    expect(after.status).toBe('partial'); expect(after.metrics.steps.value).toBe(1234)
    expect(after.quality.some(q => q.includes('无法读取或解析'))).toBe(true)
    expect(await readFile(join(dir, '佳明快照.json'), 'utf8')).toBe(bytes)
  } finally { await rm(root, { recursive: true, force: true }) }
})
