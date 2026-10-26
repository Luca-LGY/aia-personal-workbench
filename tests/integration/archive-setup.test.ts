import { test,expect } from 'vitest'
import { mkdtemp,mkdir,writeFile,readFile,rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ArchiveRepository } from '../../src/main/archive/repository'
import { SyncJournal } from '../../src/main/sync/journal'
import { SyncCoordinator } from '../../src/main/sync/coordinator'
import { MigrationService } from '../../src/main/sync/migration'
import { ArchiveSetupService } from '../../src/main/sync/archive-setup'
import { WorkspaceService } from '../../src/main/workspace'
import { MemoryEndpoint } from '../helpers/memory-endpoint'
async function setup(){const root=await mkdtemp(join(tmpdir(),'aia-setup-')),repo=new ArchiveRepository(join(root,'current'),join(root,'state'));await repo.open();const journal=new SyncJournal(repo.stateRoot,repo.info.archiveId);await journal.open();const remote=new MemoryEndpoint('webdav',undefined,journal),bindings=async()=>[{adapter:remote,configRevision:1,initializeEmpty:true}],coordinator=new SyncCoordinator(repo,journal,bindings);await coordinator.open();const migration=new MigrationService(repo,coordinator,bindings);let ready=true;const service=new ArchiveSetupService(repo,coordinator,migration,new WorkspaceService(repo.stateRoot),{baseRoot:repo.stateRoot,legacyReader:async()=>({detected:true,ready,detail:ready?'已核对原写入器停止':'原写入器仍在运行'})});return{root,repo,journal,remote,coordinator,service,legacyReady:(value:boolean)=>{ready=value},close:()=>rm(root,{recursive:true,force:true})}}
test('default archive starts read-only and enabling is bound to the current complete comparison',async()=>{
 const t=await setup();try{await writeFile(join(t.repo.root,'a.md'),'local');const before=await t.coordinator.run('manual');expect(before.phase).toBe('setup_required');expect(t.remote.writes).toBe(0);await writeFile(join(t.repo.root,'b.md'),'new');await expect(t.service.enable(before.comparison!.id)).rejects.toThrow(/变化|重新/);expect(t.remote.writes).toBe(0);const now=t.coordinator.getState();expect((await t.service.enable(now.comparison!.id)).phase).toBe('synced');expect(t.remote.files.get('a.md')?.bytes.toString()).toBe('local')}finally{await t.close()}
})
test('source inspection and pre-attachment backup are read-only; attach requires the exact backup and stopped legacy writer',async()=>{
 const t=await setup();try{const source=join(t.root,'legacy');await mkdir(source);await writeFile(join(source,'study.md'),'source bytes');await writeFile(join(source,'unknown.bin'),Buffer.from([0,255]));t.legacyReady(false);const preview=await t.service.inspect(source);expect(preview.files.length).toBe(2);await expect(readFile(join(source,'.aia/catalog.json'))).rejects.toThrow();await expect(t.service.attach(preview.id)).rejects.toThrow(/备份|交接|运行/);await t.service.backup(preview.id,join(t.root,'source.zip'));await expect(readFile(join(source,'.aia/catalog.json'))).rejects.toThrow();await expect(t.service.attach(preview.id)).rejects.toThrow(/交接|运行/);t.legacyReady(true);const attached=await t.service.attach(preview.id);expect(attached.archiveRoot).toContain('/legacy');expect(JSON.parse(await readFile(join(source,'.aia/catalog.json'),'utf8')).archiveId).toBe(preview.archiveId);expect(await readFile(join(source,'study.md'),'utf8')).toBe('source bytes');expect(JSON.parse(await readFile(join(t.repo.stateRoot,'settings/workspace.json'),'utf8')).archiveRoot).toBe(attached.archiveRoot)}finally{await t.close()}
})
test('a source edit invalidates a prior backup and cannot create metadata or switch the workspace',async()=>{
 const t=await setup();try{const source=join(t.root,'legacy');await mkdir(source);await writeFile(join(source,'data.txt'),'old');const p=await t.service.inspect(source);await t.service.backup(p.id,join(t.root,'old.zip'));await writeFile(join(source,'data.txt'),'new');await expect(t.service.attach(p.id)).rejects.toThrow(/变化|重新/);await expect(readFile(join(source,'.aia/catalog.json'))).rejects.toThrow();await expect(readFile(join(t.repo.stateRoot,'settings/workspace.json'))).rejects.toThrow()}finally{await t.close()}
})
test('legacy writer evidence blocks publication even from an already-enabled local archive',async()=>{
 const t=await setup();try{const initial=await t.coordinator.run('manual');await t.service.enable(initial.comparison!.id);const writes=t.remote.writes;t.legacyReady(false);await writeFile(join(t.repo.root,'new.md'),'must stay local');const state=await t.coordinator.run('manual');expect(state.phase).toBe('setup_required');await expect(t.service.enable(state.comparison!.id)).rejects.toThrow(/写入器|交接|运行/);expect(t.remote.writes).toBe(writes);expect(t.remote.files.has('new.md')).toBe(false)}finally{await t.close()}
})
