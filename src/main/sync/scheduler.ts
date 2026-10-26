import type { SyncReason } from '../../shared/sync'
export class SyncScheduler{
 private timer:ReturnType<typeof setInterval>|undefined;private debounce:ReturnType<typeof setTimeout>|undefined;private started=false
 constructor(private run:(reason:SyncReason)=>Promise<unknown>){}
 start(){if(this.started)return;this.started=true;void this.run('startup');this.timer=setInterval(()=>{void this.run('timer')},300000);this.timer.unref?.()}
 localChange(){if(!this.started)return;clearTimeout(this.debounce);this.debounce=setTimeout(()=>{void this.run('local-change')},10000);this.debounce.unref?.()}
 stop(){this.started=false;clearInterval(this.timer);clearTimeout(this.debounce)}
}
