import { mkdir,readFile,open,rename,unlink,readdir } from 'node:fs/promises'
import { dirname,join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { hashBytes } from './codec'
import { safePath } from './paths'
export interface FileChange {path:string;bytes:Buffer|null;expectedHash:string|null}
interface TxEntry {path:string;before:string|null;after:string|null}
interface Tx {id:string;status:'prepared'|'committed'|'conflict';entries:TxEntry[]}
export type Stage='prepared'|'applied'|'committed'
export async function readMaybe(path:string):Promise<Buffer|null>{try{return await readFile(path)}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e}}
export async function atomicWrite(path:string,bytes:Buffer|string){
 await mkdir(dirname(path),{recursive:true});const tmp=join(dirname(path),'.aia-tmp-'+randomUUID());let file
 try{file=await open(tmp,'wx',0o600);await file.writeFile(bytes);await file.sync();await file.close();file=undefined;await rename(tmp,path);const dir=await open(dirname(path),'r');try{await dir.sync()}finally{await dir.close()}}
 catch(e){await file?.close().catch(()=>{});await unlink(tmp).catch(()=>{});throw e}
}
export class TransactionStore{
 private tail:Promise<unknown>=Promise.resolve()
 constructor(readonly root:string,readonly state:string,readonly onStage?:(s:Stage)=>void){}
 private dir(){return join(this.state,'state','transactions')}
 async storeObject(bytes:Buffer){const hash=hashBytes(bytes),p=join(this.state,'state','objects',hash);const prior=await readMaybe(p);if(prior&&hashBytes(prior)!==hash)throw Error('CORRUPT_STORED_OBJECT');if(!prior)await atomicWrite(p,bytes);return hash}
 async object(hash:string){if(!/^[a-f0-9]{64}$/.test(hash))throw Error('Invalid object hash');const bytes=await readFile(await safePath(this.state,join('state','objects',hash)));if(hashBytes(bytes)!==hash)throw Error('CORRUPT_STORED_OBJECT');return bytes}
 async commit(changes:FileChange[]):Promise<string>{
  const work=this.tail.then(async()=>{
   const entries:TxEntry[]=[]
   const paths=new Set<string>()
   for(const c of changes){if(paths.has(c.path))throw Error('Duplicate transaction path');paths.add(c.path);const p=await safePath(this.root,c.path),prior=await readMaybe(p),before=prior?hashBytes(prior):null;if(before!==c.expectedHash)throw Error('CONFLICT: file changed: '+c.path);if(prior)await this.storeObject(prior);const after=c.bytes?await this.storeObject(c.bytes):null;entries.push({path:c.path,before,after})}
   const tx:Tx={id:randomUUID(),status:'prepared',entries};await this.saveTx(tx);this.onStage?.('prepared')
   for(const entry of entries){await this.apply(entry);this.onStage?.('applied')}
   tx.status='committed';await this.saveTx(tx);this.onStage?.('committed');return tx.id
  });this.tail=work.catch(()=>{});return work
 }
 private async saveTx(tx:Tx){await atomicWrite(join(this.dir(),tx.id+'.json'),JSON.stringify(tx))}
 private async apply(e:TxEntry){const p=await safePath(this.root,e.path),prior=await readMaybe(p),current=prior?hashBytes(prior):null;if(current===e.after)return;if(current!==e.before)throw Error('CONFLICT during recovery: '+e.path);if(e.after===null)await unlink(p);else await atomicWrite(p,await this.object(e.after))}
 async recover(){await mkdir(this.dir(),{recursive:true});const recovered:string[]=[],conflicts:string[]=[];for(const name of (await readdir(this.dir())).sort()){if(!name.endsWith('.json'))continue;const tx=JSON.parse(await readFile(join(this.dir(),name),'utf8')) as Tx;if(tx.status!=='prepared')continue;try{for(const e of tx.entries)if(e.after)await this.object(e.after);for(const e of tx.entries)await this.apply(e);tx.status='committed';recovered.push(tx.id)}catch(e){if(!(e instanceof Error)||!e.message.startsWith('CONFLICT'))throw e;tx.status='conflict';conflicts.push(tx.id)}await this.saveTx(tx)}return{recovered,conflicts}}
 async idle(){await this.tail}
 exclusive<T>(read:()=>Promise<T>){const work=this.tail.then(read);this.tail=work.catch(()=>{});return work}
}
