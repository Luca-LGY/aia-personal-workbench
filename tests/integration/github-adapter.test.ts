import { test,expect } from 'vitest'
import { mkdtemp,rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fakeGithub } from '../helpers/fake-github'
import { GithubAdapter } from '../../src/main/sync/adapters/github'
import { SyncJournal } from '../../src/main/sync/journal'
import { digest } from '../../src/main/sync/graph'
import { RequestBudget } from '../../src/main/sync/request-budget'
import type { ChangeBatch,ScanResult } from '../../src/shared/sync'
async function setup(options:Parameters<typeof fakeGithub>[0]={}){
 const server=await fakeGithub(options),root=await mkdtemp(join(tmpdir(),'aia-github-')),store=new SyncJournal(root,'synthetic');await store.open()
 const config={owner:server.owner,repo:server.repo,branch:server.branch,apiBase:server.url,allowTestHTTP:true,getSecret:async()=>'SYNTHETIC_ONLY',stateRoot:root,objectStore:store,budget:new RequestBudget(root,server.url,{maxRequests:5000})}
 return {server,root,store,config,adapter:new GithubAdapter(config),close:async()=>{await server.close();await rm(root,{recursive:true,force:true})}}
}
async function batch(t:Awaited<ReturnType<typeof setup>>,scan:ScanResult,files:Record<string,string|Buffer|null>):Promise<ChangeBatch>{
 const changes=await Promise.all(Object.entries(files).map(async([path,value])=>{const previous=scan.entries.find(e=>e.path===path),bytes=value===null?null:Buffer.from(value),hash=bytes===null?null:digest(bytes);if(bytes&&hash)await t.store.putObject(hash,bytes);return{operationId:digest(path+hash),path,kind:hash===null?'delete' as const:'put' as const,objectHash:hash,nodeId:digest('node'+path+hash),baseNodeId:null,expected:previous?{type:'present' as const,hash:previous.hash,revision:previous.revision}:{type:'absent' as const}}}))
 return{id:digest(JSON.stringify(changes)+scan.revision),endpointId:'github',namespace:t.adapter.namespace,scanRevision:scan.revision,changes}
}
test('fixed commit uses its real tree SHA, truncated recursive walk falls back and preserves binary and empty bytes',async()=>{
 const t=await setup({truncateRecursive:true});try{t.server.edit('目录 #/binary.bin',Buffer.from([0,255,7]));t.server.edit('zero.txt','');const head=t.server.head,tree=t.server.commits.get(head)!.tree.sha,scan=await t.adapter.scan();expect(scan).toMatchObject({complete:true,revision:head});expect(scan.entries.map(e=>e.path).sort()).toEqual(['zero.txt','目录 #/binary.bin']);expect(t.server.requests.some(r=>r.path.endsWith('/trees/'+tree))).toBe(true);const file=scan.entries.find(e=>e.path.endsWith('bin'))!;expect(await t.adapter.read(file.path,file.revision)).toEqual(Buffer.from([0,255,7]));expect(scan.entries.find(e=>e.path==='zero.txt')?.hash).toBe(digest(''))}finally{await t.close()}
})
test('a branch advance during tree download cannot mix content from different commits',async()=>{
 const t=await setup();try{t.server.edit('a.md','old');const head=t.server.head;let changed=false
  const adapter=new GithubAdapter({...t.config,transport:async(url,options)=>{const response=await fetch(url,options);if(url.includes('/git/trees/')&&!changed){changed=true;t.server.edit('a.md','new')}return response}})
  const scan=await adapter.scan();expect(scan.revision).toBe(head);expect(scan.entries[0].hash).toBe(digest('old'));expect((await adapter.read('a.md',scan.entries[0].revision)).toString()).toBe('old')
 }finally{await t.close()}
})
test('blob content or length inconsistent with immutable SHA is excluded from a complete scan',async()=>{
 const t=await setup();try{t.server.edit('a.md','original');const adapter=new GithubAdapter({...t.config,transport:async(url,options)=>{const response=await fetch(url,options);return url.includes('/git/blobs/')?new Response('corrupt',{status:200}):response}}),scan=await adapter.scan();expect(scan.complete).toBe(false);expect(scan.entries).toHaveLength(0);expect(scan.warnings?.join()).toContain('a.md')
 }finally{await t.close()}
})
test('one fast-forward commit changes, creates and deletes files while retaining unknown files and executable mode',async()=>{
 const t=await setup();try{t.server.edit('old.txt','old');t.server.edit('keep.bin',Buffer.from([9,0]));t.server.edit('run.sh','old script','100755');const scan=await t.adapter.scan(),tree=t.server.commits.get(scan.revision)!.tree.sha,b=await batch(t,scan,{'old.txt':null,'新记录.md':'正文','run.sh':'new script'}),r=await t.adapter.apply(b);expect(r.complete).toBe(true);expect(r.committedRevision).toBe(t.server.head);expect(t.server.commitPosts).toBe(1);expect(t.server.files().get('keep.bin')).toEqual(Buffer.from([9,0]));expect(t.server.files().has('old.txt')).toBe(false);const request=t.server.requests.find(r=>r.path.endsWith('/git/trees')&&r.method==='POST')!;expect(request.body?.base_tree).toBe(tree);expect(request.body?.tree).toContainEqual(expect.objectContaining({path:'old.txt',sha:null}));expect(request.body?.tree).toContainEqual(expect.objectContaining({path:'run.sh',mode:'100755'}));expect(t.server.requests.find(r=>r.method==='PATCH')?.body).toEqual({sha:r.committedRevision,force:false});for(const i of r.items)expect(i.status).toBe('confirmed')}finally{await t.close()}
})
test.each(['preflight','patch'] as const)('remote advance at %s keeps external edits and never confirms an orphan commit',async point=>{
 const t=await setup();try{t.server.edit('a.md','base');const scan=await t.adapter.scan(),b=await batch(t,scan,{'a.md':'local'});if(point==='preflight')t.server.edit('a.md','external');else t.server.options.beforeRefUpdate=()=>{t.server.options.beforeRefUpdate=undefined;t.server.edit('a.md','external')};const r=await t.adapter.apply(b);expect(r.complete).toBe(false);expect(r.items.every(i=>i.status!=='confirmed')).toBe(true);expect(t.server.files().get('a.md')?.toString()).toBe('external');if(point==='preflight')expect(t.server.commitPosts).toBe(0)}finally{await t.close()}
})
test('accepted reference with lost response is read back and restarting the same batch creates no duplicate commit',async()=>{
 const t=await setup({loseRefReplyOnce:true});try{const scan=await t.adapter.scan(),b=await batch(t,scan,{'a.md':'accepted'}),first=await t.adapter.apply(b);expect(first.complete).toBe(true);const head=t.server.head;expect((await new GithubAdapter(t.config).apply(b)).complete).toBe(true);expect(t.server.head).toBe(head);expect(t.server.commitPosts).toBe(1)}finally{await t.close()}
})
test('lost create-commit response is retried with the identical persisted commit identity and parent',async()=>{
 const t=await setup({loseCommitReplyOnce:true});try{const b=await batch(t,await t.adapter.scan(),{'a.md':'accepted'}),first=await t.adapter.apply(b);expect(first.complete).toBe(false);const r=await new GithubAdapter(t.config).apply(b);expect(r.complete).toBe(true);const posts=t.server.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/git/commits'));expect(posts).toHaveLength(2);expect(posts[0].body).toEqual(posts[1].body);expect(t.server.commits.get(t.server.head)?.parents[0].sha).toBe(b.scanRevision)}finally{await t.close()}
})
test('published commit and later edited descendant are distinguished in receipts',async()=>{
 const t=await setup();try{const b=await batch(t,await t.adapter.scan(),{'a.md':'ours'});t.server.options.afterRefUpdate=()=>{t.server.options.afterRefUpdate=undefined;t.server.edit('a.md','later edit')};const r=await t.adapter.apply(b);expect(r.complete).toBe(false);expect(r.committedRevision).toBeTruthy();expect(r.currentRevision).toBe(t.server.head);expect(r.committedRevision).not.toBe(r.currentRevision);expect(r.items[0].status).toBe('confirmed');expect(t.server.files().get('a.md')?.toString()).toBe('later edit')}finally{await t.close()}
})
test('ten no-change rounds create no objects or commits; private 401 and missing repository do not retry',async()=>{
 const t=await setup();try{for(let i=0;i<10;i++){const scan=await t.adapter.scan();expect((await t.adapter.apply(await batch(t,scan,{}))).complete).toBe(true)}expect(t.server.blobPosts).toBe(0);expect(t.server.commitPosts).toBe(0)}finally{await t.close()}
 for(const authStatus of [401,404]){const denied=await setup({authStatus});try{await expect(denied.adapter.scan()).rejects.toMatchObject({code:authStatus===401?'unauthorized':'not_found'});expect(denied.server.requests).toHaveLength(1)}finally{await denied.close()}}
})
test('truncated direct trees, oversized files, LFS pointers and symlinks remain explicitly incomplete',async()=>{
 for(const mode of ['truncated','oversized','lfs','symlink']){const t=await setup(mode==='truncated'?{truncateRecursive:true,truncateNonRecursive:true}:mode==='oversized'?{oversizedPaths:new Set(['a.md'])}:{});try{t.server.edit('a.md',mode==='lfs'?'version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 500\n':'bytes',mode==='symlink'?'120000':'100644');const scan=await t.adapter.scan();expect(scan.complete).toBe(false);expect(scan.warnings?.join()).toMatch(/a.md|截断/);await expect(t.adapter.apply(await batch(t,scan,{'new.txt':'unsafe'}))).rejects.toMatchObject({code:'incomplete'});expect(t.server.commitPosts).toBe(0)}finally{await t.close()}}
})
test('write permission failure and a rewritten history never become successful publication',async()=>{
 const t=await setup();try{const original=t.server.head;t.server.edit('a.md','base');const scan=await t.adapter.scan(),b=await batch(t,scan,{'a.md':'local'});t.server.options.writable=false;expect((await t.adapter.apply(b)).complete).toBe(false);expect(t.server.commitPosts).toBe(0);t.server.options.writable=true;t.server.rewrite(original);const next=await t.adapter.scan();expect(next.historyRewritten).toBe(true);expect((await t.adapter.apply(b)).complete).toBe(false)}finally{await t.close()}
})
