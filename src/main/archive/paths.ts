import { lstat,mkdir,realpath,readdir } from 'node:fs/promises'
import { isAbsolute,join,relative,resolve,sep } from 'node:path'
export async function safePath(root:string,path:string){
 if(isAbsolute(path)||path.includes('\0')||path.split(/[\\/]/).some(p=>p==='..'))throw Error('PATH outside archive')
 const target=resolve(root,path),rel=relative(root,target);if(rel.startsWith('..')||isAbsolute(rel))throw Error('PATH outside archive')
 const parts=rel.split(sep);let cursor=root
 for(const part of parts){cursor=join(cursor,part);try{if((await lstat(cursor)).isSymbolicLink())throw Error('PATH symbolic link forbidden')}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}}
 return target
}
export async function ensureRoot(root:string){await mkdir(root,{recursive:true});return realpath(root)}
export async function walkFiles(root:string,includeMeta=false):Promise<string[]>{
 const result:string[]=[]
 async function walk(dir:string){for(const ent of await readdir(join(root,dir),{withFileTypes:true})){if(ent.name==='.git'||(!includeMeta&&ent.name==='.aia')||ent.name.startsWith('.aia-tmp-'))continue;const p=join(dir,ent.name);if(ent.isSymbolicLink())continue;if(ent.isDirectory())await walk(p);else if(ent.isFile())result.push(p)}}
 await walk('');return result.sort()
}
