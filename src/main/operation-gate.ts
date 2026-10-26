export class OperationGate{
 private frozen=false;private active=0;private waiting:(()=>void)[]=[];private draining:(()=>void)[]=[];private tail:Promise<unknown>=Promise.resolve()
 async run<T>(work:()=>Promise<T>):Promise<T>{while(this.frozen)await new Promise<void>(resolve=>this.waiting.push(resolve));this.active++;try{return await work()}finally{this.active--;if(!this.active){for(const resolve of this.draining.splice(0))resolve()}}}
 freeze<T>(work:()=>Promise<T>):Promise<T>{const next=this.tail.then(async()=>{this.frozen=true;if(this.active)await new Promise<void>(resolve=>this.draining.push(resolve));try{return await work()}finally{this.frozen=false;for(const resolve of this.waiting.splice(0))resolve()}});this.tail=next.catch(()=>{});return next}
 async idle(){if(this.active)await new Promise<void>(resolve=>this.draining.push(resolve));await this.tail}
}
