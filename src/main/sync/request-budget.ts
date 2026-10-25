import { join } from 'node:path'
import { atomicWrite, readMaybe } from '../archive/transactions'
import { digest } from './graph'
import { SyncError } from './errors'
const queues = new Map<string, Promise<unknown>>()
export interface SyncClock { now(): number }
export class RequestBudget {
  private path: string; private clock: SyncClock; private limit: number; private windowMs: number
  constructor(root: string, account: string, options: { clock?: SyncClock; maxRequests?: number; windowMs?: number } = {}) { this.path = join(root, 'state/request-budgets', digest(account) + '.json'); this.clock = options.clock ?? { now: () => Date.now() }; this.limit = options.maxRequests ?? 300; this.windowMs = options.windowMs ?? 30 * 60 * 1000 }
  private queue<T>(work: () => Promise<T>) { const task = (queues.get(this.path) ?? Promise.resolve()).then(work); queues.set(this.path, task.catch(() => {})); return task }
  private async state() { const bytes = await readMaybe(this.path); return bytes ? JSON.parse(bytes.toString()) as { timestamps: number[]; blockedUntil: number } : { timestamps: [], blockedUntil: 0 } }
  reserve() { return this.queue(async () => { const now = this.clock.now(), state = await this.state(); state.timestamps = state.timestamps.filter(t => t > now - this.windowMs); if (state.blockedUntil > now) throw new SyncError('rate_limited', '服务端要求稍后重试', state.blockedUntil - now); if (state.timestamps.length >= this.limit) throw new SyncError('rate_limited', '本APP请求预算已用完，待窗口恢复后继续', Math.max(1, state.timestamps[0] + this.windowMs - now)); state.timestamps.push(now); await atomicWrite(this.path, JSON.stringify(state)) }) }
  defer(retryAfter: string | null) { return this.queue(async () => { const now = this.clock.now(), seconds = retryAfter && /^\d+(\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : retryAfter ? Date.parse(retryAfter) - now : NaN, delay = Number.isFinite(seconds) ? Math.max(1000, seconds) : 60000, state = await this.state(); state.blockedUntil = Math.max(state.blockedUntil, now + delay); await atomicWrite(this.path, JSON.stringify(state)); return state.blockedUntil - now }) }
}
