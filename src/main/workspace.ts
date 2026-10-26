import { isAbsolute,relative } from 'node:path'
import { realpath,readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { atomicWrite,readMaybe } from './archive/transactions'
export interface WorkspacePaths{archiveRoot:string;stateRoot:string}
export async function validateWorkspace(paths:WorkspacePaths){if(!isAbsolute(paths.archiveRoot)||!isAbsolute(paths.stateRoot))throw Error('档案目录必须为绝对路径');const archiveRoot=await realpath(paths.archiveRoot),stateRoot=await realpath(paths.stateRoot),r=relative(archiveRoot,stateRoot);if(!r||(!r.startsWith('..')&&!isAbsolute(r)))throw Error('状态目录必须位于档案之外');const catalog=JSON.parse(await readFile(join(archiveRoot,'.aia/catalog.json'),'utf8'));if(catalog.schemaVersion!==1||typeof catalog.archiveId!=='string')throw Error('档案目录格式无法读取');return{archiveRoot,stateRoot}}
export async function loadWorkspace(baseRoot:string,fallback:WorkspacePaths){const raw=await readMaybe(join(baseRoot,'settings/workspace.json'));if(!raw)return fallback;const value=JSON.parse(raw.toString());if(value.schemaVersion!==1)throw Error('档案位置设置版本无法读取');return validateWorkspace(value)}
export class WorkspaceService{constructor(private baseRoot:string){}async select(paths:WorkspacePaths){const next=await validateWorkspace(paths);await atomicWrite(join(this.baseRoot,'settings/workspace.json'),JSON.stringify({schemaVersion:1,...next}));return next}}
