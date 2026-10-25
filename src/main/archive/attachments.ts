import { readFile } from 'node:fs/promises'
import { basename,extname,join } from 'node:path'
import { hashBytes } from './codec'
import { atomicWrite,readMaybe } from './transactions'
import { safePath } from './paths'
import type { AttachmentRef } from '../../shared/models'
export class AttachmentStore{
 constructor(readonly root:string,readonly state:string){}
 async add(file:string):Promise<AttachmentRef>{const bytes=await readFile(file),hash=hashBytes(bytes),meta=join(this.root,'.aia','attachments',hash+'.json'),prior=await readMaybe(meta);if(prior)return JSON.parse(prior.toString()) as AttachmentRef;const path=join('附件',hash+extname(file).replace(/[^.a-zA-Z0-9]/g,''));await atomicWrite(await safePath(this.root,path),bytes);const ref={id:hash,path,hash,name:basename(file),size:bytes.length};await atomicWrite(meta,JSON.stringify(ref));return ref}
}
export class DraftStore{
 constructor(readonly state:string){}
 private path(key:string){if(!/^[a-zA-Z0-9_-]+$/.test(key))throw Error('Invalid draft key');return join(this.state,'state','drafts',key+'.txt')}
 async save(key:string,text:string){await atomicWrite(this.path(key),text)}
 async load(key:string){return(await readMaybe(this.path(key)))?.toString()??''}
}
