import lockfile from 'proper-lockfile'
import { realpath } from 'node:fs/promises'
export class ArchiveLease{
 private constructor(private unlock:()=>Promise<void>){}
 static async acquire(root:string,waitForCrash=false){try{return new ArchiveLease(await lockfile.lock(await realpath(root),{realpath:true,stale:10000,update:2000,retries:waitForCrash?{retries:11,minTimeout:1000,maxTimeout:1000}:0,onCompromised:()=>{throw Error('档案写入锁已失效，请退出后重新打开')}}))}catch{throw Error('此档案已由另一个 APP 进程占用，请先关闭另一个窗口。')}}
 async release(){await this.unlock()}
}
