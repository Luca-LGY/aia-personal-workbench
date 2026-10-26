import { randomUUID } from 'node:crypto'
import { join,dirname,resolve,relative,isAbsolute } from 'node:path'
import { mkdir,realpath,rename,rm,stat,open } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { ZipFile } from 'yazl'
import type { ArchiveRepository } from '../archive/repository'
import type { SyncCoordinator } from './coordinator'
import type { MigrationService } from './migration'
import type { WorkspaceService } from '../workspace'
import type { SourcePreview,LegacyEvidence } from '../../shared/setup'
import type { BackupManifest } from '../../shared/backup'
import { readLegacyEvidence } from './legacy-evidence'
import { atomicWrite,readMaybe,TransactionStore } from '../archive/transactions'
import { safePath } from '../archive/paths'
import { digest } from './graph'
import { fileHash,validateNames } from '../backup/manifest'
import { inspectBackup } from '../backup/restorer'
import { ArchiveLease } from './archive-lease'
interface Options{baseRoot:string;legacyReader?:(root:string)=>Promise<LegacyEvidence>}
export class ArchiveSetupService{
 constructor(private repo:ArchiveRepository,private coordinator:SyncCoordinator,private migration:MigrationService,private workspace:WorkspaceService,private options:Options){coordinator.setPublicationGuard(async()=>{const e=await this.legacy(repo.root);return e.ready?null:e.detail})}
 private legacy(root:string){return(this.options.legacyReader??readLegacyEvidence)(root)}
 private path(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('来源清单编号无效');return join(this.repo.stateRoot,'state/sync',this.repo.info.archiveId,'sources',id+'.json')}
 private save(value:SourcePreview){return atomicWrite(this.path(value.id),JSON.stringify(value))}
 private async get(id:string){const bytes=await readMaybe(this.path(id));if(!bytes)throw Error('请重新检查来源目录');const p=JSON.parse(bytes.toString())as SourcePreview;if(p.id!==id||!p.sourceRoot||!p.fingerprint||!Array.isArray(p.files))throw Error('来源清单无法读取');return p}
 async refresh(id:string){const p=await this.get(id),source=await this.migration.inspectSource(p.sourceRoot);if(source.fingerprint!==p.fingerprint)return this.inspect(p.sourceRoot);p.legacy=await this.legacy(p.sourceRoot);await this.save(p);return p}
 async inspect(sourceRoot:string):Promise<SourcePreview>{const root=await realpath(sourceRoot),rel=relative(root,this.repo.stateRoot);if(!rel||(!rel.startsWith('..')&&!isAbsolute(rel)))throw Error('请选择独立的档案文件夹，不能包含本APP运行状态');const inventory=await this.migration.inspectSource(root),catalog=await readMaybe(await safePath(root,'.aia/catalog.json')),existing=catalog?JSON.parse(catalog.toString()):null,p:SourcePreview={id:randomUUID(),sourceRoot:root,archiveId:existing?.archiveId??randomUUID(),fingerprint:inventory.fingerprint,files:inventory.files,excluded:inventory.excluded,hasCatalog:!!catalog,legacy:await this.legacy(root)};await this.save(p);return p}
 async backup(id:string,destination:string){const p=await this.get(id);if(p.hasCatalog)throw Error('已有APP档案请使用完整备份与恢复面板');const rel=relative(p.sourceRoot,resolve(destination));if(!rel||(!rel.startsWith('..')&&!isAbsolute(rel)))throw Error('接入前备份应保存在来源目录之外');const current=await this.migration.inspectSource(p.sourceRoot);if(current.fingerprint!==p.fingerprint)throw Error('来源已变化，请重新检查并备份');const catalog=Buffer.from(JSON.stringify({archiveId:p.archiveId,schemaVersion:1})),hash=digest(catalog);await this.coordinator.journal.putObject(hash,catalog)
  const entries=[...p.files.map(f=>({path:'archive/'+f.path,size:f.size,hash:f.hash})),{path:'archive/.aia/catalog.json',size:catalog.length,hash}];validateNames(entries.map(e=>e.path));const manifest:BackupManifest={schemaVersion:1,appVersion:'0.1.0',archiveId:p.archiveId,createdAt:new Date().toISOString(),entries,records:[],attachments:[],excluded:['原.git历史与设备状态','凭据、缓存、设备状态及已声明忽略项'],notes:['这是接入前工作文件备份；原Git历史及设备回执须在Codex交接时另存本机回滚包。','来源目录未写入APP元数据；恢复后发布暂停。']},temp=join(dirname(resolve(destination)),'.aia-source-'+randomUUID()+'.zip')
  try{const zip=new ZipFile(),done=pipeline(zip.outputStream,createWriteStream(temp,{flags:'wx',mode:0o600}));zip.addBuffer(Buffer.from(JSON.stringify(manifest)),'manifest.json');for(const e of entries)zip.addFile(await this.coordinator.journal.objectPath(e.hash),e.path);zip.end();await done;const f=await open(temp,'r+');try{await f.sync()}finally{await f.close()}await inspectBackup(temp);if((await this.migration.inspectSource(p.sourceRoot)).fingerprint!==p.fingerprint)throw Error('备份期间来源变化，请重新检查');const bytes=(await stat(temp)).size,checksum=await fileHash(temp);await rename(temp,destination);p.backup={file:resolve(destination),createdAt:manifest.createdAt,files:entries.length,bytes,hash:checksum};await this.save(p);return p.backup}finally{await rm(temp,{force:true})}
 }
 async attach(id:string){const p=await this.get(id);if(p.hasCatalog)throw Error('已有APP档案请从完整备份恢复，保留对应状态目录');if(!p.backup)throw Error('请先完成接入前备份');const current=await this.migration.inspectSource(p.sourceRoot);if(current.fingerprint!==p.fingerprint)throw Error('来源已变化，请重新检查并备份');if(await fileHash(p.backup.file)!==p.backup.hash)throw Error('备份已变化，请重新备份');const checked=await inspectBackup(p.backup.file);if(checked.archiveId!==p.archiveId)throw Error('备份与来源身份不一致');const legacy=await this.legacy(p.sourceRoot);if(!legacy.ready)throw Error(legacy.detail)
  const lease=await ArchiveLease.acquire(p.sourceRoot);try{if((await this.migration.inspectSource(p.sourceRoot)).fingerprint!==p.fingerprint)throw Error('来源在接入前变化，请重新检查');const stateRoot=join(this.options.baseRoot,'workspaces',p.archiveId);await mkdir(stateRoot,{recursive:true});const tx=new TransactionStore(p.sourceRoot,stateRoot);await tx.commit([{path:'.aia/catalog.json',bytes:Buffer.from(JSON.stringify({archiveId:p.archiveId,schemaVersion:1})),expectedHash:null}]);await atomicWrite(join(stateRoot,'settings/archive-ready.json'),JSON.stringify({ready:false}));await atomicWrite(join(stateRoot,'settings/source-owned.json'),JSON.stringify({sourceRoot:p.sourceRoot,backup:p.backup,legacyDetected:legacy.detected,attachedAt:new Date().toISOString()}));return this.workspace.select({archiveRoot:p.sourceRoot,stateRoot})}finally{await lease.release()}
 }
 async enable(comparisonId:string){const evidence=await this.legacy(this.repo.root);if(!evidence.ready)throw Error(evidence.detail);return this.coordinator.confirmInitialization(comparisonId)}
}
