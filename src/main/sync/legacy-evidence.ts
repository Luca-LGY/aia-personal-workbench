import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { readMaybe } from '../archive/transactions'
import type { LegacyEvidence } from '../../shared/setup'
const exec=promisify(execFile)
export async function readLegacyEvidence(root:string):Promise<LegacyEvidence>{
 const bytes=await readMaybe(join(root,'.git/archive-sync.json'));if(!bytes)return{detected:false,ready:true,detail:'未发现原档案 GitHub 文件同步配置'}
 let paused:boolean;try{paused=JSON.parse(bytes.toString()).paused===true}catch{return{detected:true,ready:false,detail:'原同步配置无法读取，请在 Codex 核对交接'}}
 if(!paused)return{detected:true,ready:false,detail:'原 GitHub 文件同步仍未暂停，请在 Codex 备份 Git 状态并完成后台交接'}
 try{await exec('/bin/launchctl',['print',`gui/${process.getuid!()}/com.local.my-ai-archive-sync`],{maxBuffer:128*1024});return{detected:true,ready:false,detail:'原文件同步启动项仍已加载，请在 Codex 停止该后台后重新检查'}}catch(e){const stderr=String((e as {stderr?:string}).stderr??'');if(/Could not find service|No such process/i.test(stderr))return{detected:true,ready:true,detail:'原文件同步已暂停，启动项已停止；继续使用交接前备份与最终清单核对'};return{detected:true,ready:false,detail:'尚不能确认原文件同步后台已停止，请在 Codex 核对'}}
}
