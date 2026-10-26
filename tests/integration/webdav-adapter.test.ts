import { test, expect } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fakeWebdav } from '../helpers/fake-webdav'
import { WebdavAdapter } from '../../src/main/sync/adapters/webdav'
import { SyncJournal } from '../../src/main/sync/journal'
import { RequestBudget } from '../../src/main/sync/request-budget'
import { digest } from '../../src/main/sync/graph'
import type { CapabilityReport } from '../../src/shared/connections'
import type { ChangeBatch, RemoteChange, ScanResult } from '../../src/shared/sync'
const capabilities: CapabilityReport = { authenticated: true, conditionalWrite: true, conditionalDelete: true, createOnly: true, unicodePaths: true, completeListing: true, verifiedAt: '2026-10-26T00:00:00Z', issues: [] }
async function setup(options: Parameters<typeof fakeWebdav>[0] = {}) {
  const server = await fakeWebdav(options), root = await mkdtemp(join(tmpdir(), 'aia-dav-')), store = new SyncJournal(root, 'test-archive'); await store.open()
  const adapter = new WebdavAdapter({ url: server.url, username: 'synthetic', getSecret: async () => 'TEST_ONLY', allowTestHTTP: true, stateRoot: root, objectStore: store, budget: new RequestBudget(root, server.url), capabilities })
  return { server, root, store, adapter, close: async () => { await server.close(); await rm(root, { recursive: true, force: true }) } }
}
function batch(t: Awaited<ReturnType<typeof setup>>, scan: ScanResult, path: string, hash: string | null, expected?: RemoteChange['expected']): ChangeBatch {
  const prior = scan.entries.find(e => e.path === path)
  const change: RemoteChange = { operationId: digest(path + hash), path, kind: hash === null ? 'delete' : 'put', nodeId: digest('node' + path + hash), objectHash: hash, baseNodeId: null, expected: expected ?? (prior ? { type: 'present', revision: prior.revision, hash: prior.hash } : { type: 'absent' }) }
  return { id: digest('batch' + change.operationId + JSON.stringify(change.expected)), endpointId: 'webdav', namespace: t.adapter.namespace, scanRevision: scan.revision, changes: [change] }
}
test('recursive Depth:1 and next-link pages include Unicode, spaces, hash and empty files; unchanged ETags reuse verified objects', async () => {
  const t = await setup({ pageSize: 1 }); try {
    t.server.seed('目录# 空格/结果.txt', '中文内容'); t.server.seed('first.txt', 'one'); t.server.seed('zero.txt', '')
    const scan = await t.adapter.scan(); expect(scan.complete).toBe(true); expect(scan.entries.map(e => e.path).sort()).toEqual(['first.txt', 'zero.txt', '目录# 空格/结果.txt'])
    expect(scan.entries.find(e => e.path === 'zero.txt')).toMatchObject({ hash: digest(''), size: 0 })
    const item = scan.entries.find(e => e.path.includes('结果'))!; expect((await t.adapter.read(item.path, item.revision)).toString()).toBe('中文内容')
    const gets = t.server.requests.filter(r => r.method === 'GET').length
    expect((await t.adapter.scan()).complete).toBe(true); expect(t.server.requests.filter(r => r.method === 'GET')).toHaveLength(gets)
    expect(t.server.requests.filter(r => r.method === 'PROPFIND').every(r => r.depth === '1')).toBe(true)
    expect(t.server.maxConcurrent).toBe(1)
  } finally { await t.close() }
})
test('revoking a saved connection after scan stops cached-authorization requests before any upload',async()=>{
 const t=await setup();try{let allowed=true;const adapter=new WebdavAdapter({url:t.server.url,username:'synthetic',getSecret:async()=>{if(!allowed)throw Error('connection disabled');return'SYNTHETIC_ONLY'},allowTestHTTP:true,stateRoot:t.root,objectStore:t.store,budget:new RequestBudget(t.root,t.server.url),capabilities});const scan=await adapter.scan(),hash=digest('must stay local');await t.store.putObject(hash,Buffer.from('must stay local'));allowed=false;const before=t.server.requests.length;try{await adapter.apply(batch({...t,adapter},scan,'private.md',hash))}catch{/* revoked requests can reject the batch */}expect(t.server.requests).toHaveLength(before);expect(t.server.files.has('/dav/private.md')).toBe(false)}finally{await t.close()}
})
test('archive scope exclusions prevent fetching protected bodies or walking ignored directories',async()=>{
 const t=await setup();try{t.server.seed('.env','SYNTHETIC_SECRET');t.server.seed('secret/inside.txt','private');t.server.seed('public.txt','public');const adapter=new WebdavAdapter({url:t.server.url,username:'synthetic',getSecret:async()=>'SYNTHETIC_ONLY',allowTestHTTP:true,stateRoot:t.root,objectStore:t.store,budget:new RequestBudget(t.root,t.server.url),capabilities,knownPaths:async()=>['.env'],includePath:path=>!path.includes('secret')&&path!=='.env'}),scan=await adapter.scan();expect(scan.complete).toBe(true);expect(scan.entries.map(e=>e.path)).toEqual(['public.txt']);expect(t.server.requests.some(r=>r.path.endsWith('/.env')||(r.method==='PROPFIND'&&r.path.includes('/secret/')))).toBe(false)}finally{await t.close()}
})
test('conditional PUT, create-only and DELETE reject racing edits and never overwrite them', async () => {
  const t = await setup(); try {
    t.server.seed('a.md', 'old'); const scan = await t.adapter.scan(); const desired = digest('new'); await t.store.putObject(desired, Buffer.from('new'))
    expect((await t.adapter.apply(batch(t, scan, 'a.md', desired))).items[0].status).toBe('confirmed')
    await t.store.putObject(digest('forbidden'), Buffer.from('forbidden'))
    const stale = await t.adapter.apply(batch(t, scan, 'a.md', digest('forbidden'))); expect(stale.items[0].status).toBe('conflict'); expect(t.server.files.get('/dav/a.md')?.toString()).toBe('new')
    const createOnly = await t.adapter.apply(batch(t, scan, 'a.md', digest('forbidden'), { type: 'absent' })); expect(createOnly.items[0].status).toBe('conflict')
    const latest = await t.adapter.scan(), deletion = batch(t, latest, 'a.md', null); t.server.seed('a.md', 'other editor')
    expect((await t.adapter.apply(deletion)).items[0].status).toBe('conflict'); expect(t.server.files.get('/dav/a.md')?.toString()).toBe('other editor')
    const final = await t.adapter.scan(); expect((await t.adapter.apply(batch(t, final, 'a.md', null))).items[0]).toMatchObject({ status: 'confirmed', hash: null, revision: null })
  } finally { await t.close() }
})
test('accepted PUT with a lost response is confirmed by readback without another PUT', async () => {
  const t = await setup({ losePutReplyOnce: true }); try {
    const scan = await t.adapter.scan(), hash = digest('accepted'); await t.store.putObject(hash, Buffer.from('accepted'))
    const r = await t.adapter.apply(batch(t, scan, '新文件 #.txt', hash))
    expect(r.items[0].status).toBe('confirmed'); expect(t.server.requests.filter(r => r.method === 'PUT')).toHaveLength(1)
  } finally { await t.close() }
})
test('401 stops after one request, 429 persists Retry-After, and 507 leaves file pending', async () => {
  const a = await setup({ authStatus: 401 }); try { await expect(a.adapter.scan()).rejects.toMatchObject({ code: 'unauthorized' }); expect(a.server.requests).toHaveLength(1) } finally { await a.close() }
  const b = await setup({ statusOnce: { method: 'PROPFIND', status: 429, retryAfter: '2' } }); try { await expect(b.adapter.scan()).rejects.toMatchObject({ code: 'rate_limited' }); await expect(b.adapter.scan()).rejects.toMatchObject({ code: 'rate_limited' }); expect(b.server.requests).toHaveLength(1) } finally { await b.close() }
  const c = await setup({ statusOnce: { method: 'PUT', status: 507 } }); try { const scan = await c.adapter.scan(), hash = digest('quota'); await c.store.putObject(hash, Buffer.from('quota')); const r = await c.adapter.apply(batch(c, scan, 'quota.txt', hash)); expect(r.complete).toBe(false); expect(r.error?.code).toBe('quota'); expect(c.server.files.size).toBe(0) } finally { await c.close() }
})
test.each([{ weakETags: true }, { omitETags: true }])('weak or missing ETag blocks conditional overwrites: %j', async options => {
  const t = await setup(options); try { t.server.seed('a.md', 'keep'); const scan = await t.adapter.scan(), hash = digest('replace'); await t.store.putObject(hash, Buffer.from('replace')); const r = await t.adapter.apply(batch(t, scan, 'a.md', hash)); expect(r.items[0].status).toBe('failed'); expect(r.error?.code).toBe('unsupported'); expect(t.server.requests.filter(r => r.method === 'PUT')).toHaveLength(0); expect(t.server.files.get('/dav/a.md')?.toString()).toBe('keep');await expect(t.adapter.read('a.md',scan.entries[0].revision)).rejects.toMatchObject({code:'unsupported'}) } finally { await t.close() }
})
test('750-limit listing without next, malformed XML and missing root are not complete empty archives', async () => {
  const t = await setup({ omitNext: true }); try { for (let i = 0; i < 751; i++) t.server.seed(`file-${i}.txt`, String(i)); const scan = await t.adapter.scan(); expect(scan.complete).toBe(false); expect(scan.warnings?.join()).toContain('750'); const hash = digest('do not write'); await t.store.putObject(hash, Buffer.from('do not write')); await expect(t.adapter.apply(batch(t, scan, 'unsafe.txt', hash))).rejects.toMatchObject({ code: 'incomplete' }); expect(t.server.requests.filter(r => r.method === 'PUT')).toHaveLength(0) } finally { await t.close() }
  const malformed = await setup({ truncated: true }); try { expect((await malformed.adapter.scan()).complete).toBe(false) } finally { await malformed.close() }
  const missing = await setup(); try { missing.server.dirs.clear(); const scan = await missing.adapter.scan(); expect(scan).toMatchObject({ complete: false, rootExists: false }); expect(scan.entries).toHaveLength(0) } finally { await missing.close() }
})
test('large binary uploads stream from the verified object file without loading the whole object through read API', async () => {
  const t = await setup(); try {
    const bytes = Buffer.alloc(16 * 1024 * 1024, 7), hash = digest(bytes); await t.store.putObject(hash, bytes)
    const adapter = new WebdavAdapter({ url: t.server.url, username: 'synthetic', getSecret: async () => 'TEST_ONLY', allowTestHTTP: true, stateRoot: t.root, objectStore: { object: async () => { throw Error('Whole-object read is forbidden for this upload') }, putObject: t.store.putObject.bind(t.store), objectPath: t.store.objectPath.bind(t.store), ingest: t.store.ingest.bind(t.store), hasObject: t.store.hasObject.bind(t.store) }, budget: new RequestBudget(t.root, t.server.url), capabilities })
    const scan = await adapter.scan(), r = await adapter.apply(batch({ ...t, adapter }, scan, 'large.bin', hash))
    expect(r.complete).toBe(true); expect(t.server.files.get('/dav/large.bin')?.length).toBe(bytes.length)
  } finally { await t.close() }
})
test('unverified conditional capability blocks writes and 503 Retry-After also holds subsequent requests',async()=>{
 const t=await setup();try{
  const adapter=new WebdavAdapter({url:t.server.url,username:'synthetic',getSecret:async()=>'TEST_ONLY',allowTestHTTP:true,stateRoot:t.root,objectStore:t.store,budget:new RequestBudget(t.root,t.server.url),capabilities:{...capabilities,conditionalWrite:false}})
  const scan=await adapter.scan(),hash=digest('blocked');await t.store.putObject(hash,Buffer.from('blocked'))
  await expect(adapter.apply(batch({...t,adapter},scan,'blocked.txt',hash))).rejects.toMatchObject({code:'unsupported'})
  expect(t.server.requests.filter(r=>r.method==='PUT')).toHaveLength(0)
 }finally{await t.close()}
 const retry=await setup({statusOnce:{method:'PROPFIND',status:503,retryAfter:'3'}});try{
  await expect(retry.adapter.scan()).rejects.toMatchObject({code:'offline',retryAfterMs:3000})
  await expect(retry.adapter.scan()).rejects.toMatchObject({code:'rate_limited'})
  expect(retry.server.requests).toHaveLength(1)
 }finally{await retry.close()}
})
test('length mismatch is excluded from candidates and cannot become complete through cache reuse',async()=>{
 const t=await setup({listedSizeOffset:7});try{
  t.server.seed('a.md','bad')
  const first=await t.adapter.scan();expect(first.complete).toBe(false);expect(first.entries).toHaveLength(0)
  const second=await t.adapter.scan();expect(second.complete).toBe(false);expect(second.entries).toHaveLength(0)
  expect(t.server.requests.filter(r=>r.method==='GET')).toHaveLength(2)
 }finally{await t.close()}
})
test('directory mutation between pages cannot omit a still-existing known file and imply deletion',async()=>{
 const t=await setup({pageSize:2});try{
  for(const name of ['a.md','b.md','c.md','d.md'])t.server.seed(name,name)
  expect((await t.adapter.scan()).entries).toHaveLength(4)
  let changed=false;t.server.options.afterList=({path,page})=>{if(path==='/dav/'&&page===1&&!changed){changed=true;t.server.files.delete('/dav/a.md')}}
  const next=await t.adapter.scan();expect(t.server.files.has('/dav/c.md')).toBe(true)
  expect(next.entries.some(e=>e.path==='c.md')).toBe(true)
  expect(t.server.requests.some(r=>r.path==='/dav/c.md'&&r.method==='HEAD')).toBe(true)
 }finally{await t.close()}
})
test('missing archive root after scan is never a confirmed file deletion',async()=>{
 const t=await setup();try{
  t.server.seed('a.md','keep');const scan=await t.adapter.scan();t.server.files.clear();t.server.dirs.clear()
  const result=await t.adapter.apply(batch(t,scan,'a.md',null))
  expect(result.complete).toBe(false);expect(result.items[0].status).not.toBe('confirmed');expect(result.error?.code).toBe('incomplete')
 }finally{await t.close()}
})
