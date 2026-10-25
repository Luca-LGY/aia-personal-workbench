import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
const sha=(s:string|Buffer)=>createHash('sha1').update(s).digest('hex')
export const gitBlobSHA=(b:Buffer)=>createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex')
interface TreeEntry{path:string;mode:string;type:'blob'|'tree'|'commit';sha:string;size?:number}
interface Commit{sha:string;tree:{sha:string};parents:{sha:string}[];message:string}
export async function fakeGithub(options:{authStatus?:number;writable?:boolean;truncateRecursive?:boolean;truncateNonRecursive?:boolean;loseRefReplyOnce?:boolean;loseCommitReplyOnce?:boolean;loseBlobReplyOnce?:boolean;afterCreateCommit?:()=>void;beforeRefUpdate?:()=>void;afterRefUpdate?:()=>void;oversizedPaths?:Set<string>}={}){
 const owner='synthetic-owner',repo='archive',branch='main',blobs=new Map<string,Buffer>(),trees=new Map<string,TreeEntry[]>(),commits=new Map<string,Commit>(),requests:{method:string;path:string;body?:Record<string,unknown>;version?:string}[]=[]
 let externalCounter=0,blobPosts=0,commitPosts=0,patches=0
 function saveTree(entries:TreeEntry[]){entries.sort((a,b)=>a.path.localeCompare(b.path));const id=sha('tree:'+JSON.stringify(entries));trees.set(id,entries);return id}
 function build(files:Map<string,{sha:string;mode:string}>){const direct:TreeEntry[]=[],groups=new Map<string,Map<string,{sha:string;mode:string}>>()
  for(const[path,file]of files){const at=path.indexOf('/');if(at<0)direct.push({path,sha:file.sha,mode:file.mode,type:'blob',size:blobs.get(file.sha)!.length});else{const folder=path.slice(0,at),rest=path.slice(at+1);if(!groups.has(folder))groups.set(folder,new Map());groups.get(folder)!.set(rest,file)}}
  for(const[path,group]of groups)direct.push({path,mode:'040000',type:'tree',sha:build(group)});return saveTree(direct)
 }
 function flatten(tree:string,prefix=''):TreeEntry[]{return(trees.get(tree)??[]).flatMap(e=>{const full={...e,path:prefix+e.path};return e.type==='tree'?[full,...flatten(e.sha,full.path+'/')]:[full]})}
 function flatFiles(tree:string){return new Map(flatten(tree).filter(e=>e.type==='blob').map(e=>[e.path,{sha:e.sha,mode:e.mode}]))}
 function makeCommit(tree:string,parents:string[],message:string,extra:unknown={}){const id=sha(JSON.stringify({tree,parents,message,extra})),value={sha:id,tree:{sha:tree},parents:parents.map(sha=>({sha})),message};commits.set(id,value);return id}
 let head=makeCommit(build(new Map()),[],'initial')
 function edit(path:string,value:string|Buffer,mode='100644'){const files=flatFiles(commits.get(head)!.tree.sha),bytes=Buffer.from(value),id=gitBlobSHA(bytes);blobs.set(id,bytes);files.set(path,{sha:id,mode});head=makeCommit(build(files),[head],'external-'+ ++externalCounter)}
 function ancestor(parent:string,child:string){const queue=[child],seen=new Set<string>();while(queue.length){const n=queue.pop()!;if(n===parent)return true;if(seen.has(n))continue;seen.add(n);queue.push(...(commits.get(n)?.parents.map(p=>p.sha)??[]))}return false}
 const server=createServer(async(req,res)=>{
  const method=req.method!,path=decodeURIComponent(new URL(req.url!,'http://localhost').pathname),u=new URL(req.url!,'http://localhost');const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));let body:Record<string,unknown>={};if(chunks.length){try{body=JSON.parse(Buffer.concat(chunks).toString()) as Record<string,unknown>}catch{res.writeHead(400);res.end();return}}
  requests.push({method,path,...(chunks.length?{body}:{}),version:req.headers['x-github-api-version'] as string|undefined})
  const json=(status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value))}
  if(options.authStatus){json(options.authStatus,{message:'synthetic denied'});return}
  if(path==='/user'){json(200,{id:101,login:'synthetic-user',name:'Synthetic Tester',email:null});return}
  const base=`/repos/${owner}/${repo}`;if(options.writable===false&&method!=='GET'){json(403,{message:'permission denied'});return}if(path===base){json(200,{private:true,permissions:{push:options.writable!==false}});return}
  if(path===base+'/git/ref/heads/'+branch&&method==='GET'){json(200,{ref:'refs/heads/'+branch,object:{sha:head,type:'commit'}});return}
  if(path===base+'/git/refs/heads/'+branch&&method==='PATCH'){
   patches++;options.beforeRefUpdate?.();if(body.force!==false||typeof body.sha!=='string'||!commits.has(body.sha)||!ancestor(head,body.sha)){json(422,{message:'not fast forward'});return}
   head=body.sha;const accepted=head;options.afterRefUpdate?.();if(options.loseRefReplyOnce){options.loseRefReplyOnce=false;req.socket.destroy();return}json(200,{ref:'refs/heads/'+branch,object:{sha:accepted}});return
  }
  if(path.startsWith(base+'/git/commits/')&&method==='GET'){const c=commits.get(path.slice((base+'/git/commits/').length));json(c?200:404,c??{message:'missing'});return}
  if(path.startsWith(base+'/git/trees/')&&method==='GET'){
   const id=path.slice((base+'/git/trees/').length),direct=trees.get(id);if(!direct){json(404,{message:'missing tree'});return}
   const recursive=u.searchParams.has('recursive'),all=recursive?flatten(id):direct,truncated=recursive?!!options.truncateRecursive:!!options.truncateNonRecursive
   const entries=(truncated?all.slice(0,1):all).map(e=>options.oversizedPaths?.has(e.path)?{...e,size:100000001}:e);json(200,{sha:id,truncated,tree:entries});return
  }
  if(path.startsWith(base+'/git/blobs/')&&method==='GET'){
   const id=path.slice((base+'/git/blobs/').length),bytes=blobs.get(id);if(!bytes){json(404,{message:'missing blob'});return}
   if(String(req.headers.accept).includes('raw')){res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':bytes.length});res.end(bytes)}else json(200,{sha:id,encoding:'base64',size:bytes.length,content:bytes.toString('base64')});return
  }
  if(path===base+'/git/blobs'&&method==='POST'){
   blobPosts++;if(typeof body.content!=='string'){json(422,{});return}const bytes=Buffer.from(body.content,body.encoding==='base64'?'base64':'utf8'),id=gitBlobSHA(bytes);blobs.set(id,bytes)
   if(options.loseBlobReplyOnce){options.loseBlobReplyOnce=false;req.socket.destroy();return}json(201,{sha:id});return
  }
  if(path===base+'/git/trees'&&method==='POST'){
   if(typeof body.base_tree!=='string'||!trees.has(body.base_tree)||!Array.isArray(body.tree)){json(422,{message:'missing base tree'});return}
   const files=flatFiles(body.base_tree)
   for(const raw of body.tree){const e=raw as {path:string;sha:string|null;mode:string};if(e.sha===null){if(!files.has(e.path)){json(422,{message:'delete missing path'});return}files.delete(e.path);}else if(blobs.has(e.sha))files.set(e.path,{sha:e.sha,mode:e.mode});else{json(422,{message:'missing blob'});return}}
   json(201,{sha:build(files)});return
  }
  if(path===base+'/git/commits'&&method==='POST'){
   commitPosts++;if(typeof body.tree!=='string'||!trees.has(body.tree)||!Array.isArray(body.parents)||body.parents.some(p=>typeof p!=='string'||!commits.has(p))){json(422,{});return}
   const id=makeCommit(body.tree,body.parents as string[],String(body.message),{author:body.author,committer:body.committer});options.afterCreateCommit?.();if(options.loseCommitReplyOnce){options.loseCommitReplyOnce=false;req.socket.destroy();return}json(201,commits.get(id));return
  }
  json(404,{message:'unhandled synthetic path'})
 })
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();if(!address||typeof address==='string')throw Error('No address')
 return{url:`http://127.0.0.1:${address.port}`,owner,repo,branch,options,requests,blobs,trees,commits,edit,rewrite:(sha:string)=>{if(!commits.has(sha))throw Error('missing commit');head=sha},get head(){return head},get blobPosts(){return blobPosts},get commitPosts(){return commitPosts},get patches(){return patches},files:()=>new Map(flatten(commits.get(head)!.tree.sha).filter(e=>e.type==='blob').map(e=>[e.path,blobs.get(e.sha)!])),close:()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
}
