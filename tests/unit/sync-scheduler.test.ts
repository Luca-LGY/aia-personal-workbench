import { test,expect,vi } from 'vitest'
import { SyncScheduler } from '../../src/main/sync/scheduler'
test('startup runs once, editing debounces ten seconds, five-minute checks stop on explicit exit',async()=>{
 vi.useFakeTimers();try{const calls:string[]=[],scheduler=new SyncScheduler(async r=>{calls.push(r)});scheduler.start();await vi.advanceTimersByTimeAsync(0);expect(calls).toEqual(['startup']);scheduler.localChange();await vi.advanceTimersByTimeAsync(9000);scheduler.localChange();await vi.advanceTimersByTimeAsync(9999);expect(calls).toEqual(['startup']);await vi.advanceTimersByTimeAsync(1);expect(calls).toEqual(['startup','local-change']);await vi.advanceTimersByTimeAsync(281000);expect(calls).toContain('timer');scheduler.stop();const count=calls.length;await vi.advanceTimersByTimeAsync(600000);expect(calls).toHaveLength(count)}finally{vi.useRealTimers()}
})
