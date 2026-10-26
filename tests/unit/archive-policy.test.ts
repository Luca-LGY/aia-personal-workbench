import { test,expect } from 'vitest'
import { mkdtemp,mkdir,writeFile,rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ArchiveRepository } from '../../src/main/archive/repository'
import { localSnapshot } from '../../src/main/sync/local-snapshot'
import { SyncJournal } from '../../src/main/sync/journal'
import { moduleForPath } from '../../src/main/archive/importer'
test('shared snapshots honor protected legacy and Git ignored files while retaining metadata and ordinary unknown files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'aia-policy-'));try{const repo=new ArchiveRepository(join(root,'archive'),join(root,'state'));await repo.open();for(const[path,text]of Object.entries({'.env':'SYNTHETIC_SECRET','cert.key':'PRIVATE','同步状态.md':'device','unknown.xyz':'unknown','.gitignore':'*.private\n','ignored.private':'private','__pycache__/x.pyc':'cache'})){await mkdir(join(repo.root,path,'..'),{recursive:true});await writeFile(join(repo.root,path),text)}const store=new SyncJournal(repo.stateRoot,repo.info.archiveId);await store.open();const scan=await localSnapshot(repo,store),paths=scan.entries.map(e=>e.path);expect(scan.complete).toBe(true);expect(paths).toContain('unknown.xyz');expect(paths).toContain('.aia/catalog.json');for(const path of ['.env','cert.key','同步状态.md','ignored.private','__pycache__/x.pyc'])expect(paths).not.toContain(path)}finally{await rm(root,{recursive:true,force:true})}
})
test('legacy and confirmed module folders map to the same module without relocating source files',()=>{
 for(const path of ['学习数据/ODE.md','每日记录/学习数据/PDE.md'])expect(moduleForPath(path)).toBe('learning')
 for(const path of ['科研实验/E-001.md','每日记录/科研实验/E-002.md'])expect(moduleForPath(path)).toBe('research')
})
