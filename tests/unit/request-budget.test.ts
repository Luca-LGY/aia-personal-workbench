import { test, expect } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { RequestBudget } from '../../src/main/sync/request-budget'
test('request budget survives restart, shares account limit and honors server cooldown', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aia-budget-')); let now = 100000; const clock = { now: () => now }
  try {
    const a = new RequestBudget(root, 'account', { clock, maxRequests: 2, windowMs: 1000 }), b = new RequestBudget(root, 'account', { clock, maxRequests: 2, windowMs: 1000 })
    await Promise.all([a.reserve(), b.reserve()]); await expect(a.reserve()).rejects.toMatchObject({ code: 'rate_limited' })
    now += 1001; await b.reserve(); await b.defer('5')
    const reopened = new RequestBudget(root, 'account', { clock, maxRequests: 2, windowMs: 1000 })
    await expect(reopened.reserve()).rejects.toMatchObject({ code: 'rate_limited', retryAfterMs: 5000 })
    now += 5001; await reopened.reserve()
  } finally { await rm(root, { recursive: true, force: true }) }
})
