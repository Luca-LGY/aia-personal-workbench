import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
export async function fakeCloud(options:{ignoreConditions?:boolean;unauthorized?:boolean;truncated?:boolean}={}){
 const files=new Map<string,Buffer>();let requests=0
 const etag=(b:Buffer)=>'"'+createHash('sha256').update(b).digest('hex')+'"'
 const server=createServer(async(req,res)=>{
  requests++;const path=decodeURIComponent(new URL(req.url!,'http://localhost').pathname)
  if(options.unauthorized){res.writeHead(401);res.end();return}
  const prior=files.get(path), tag=prior?etag(prior):undefined
  if(!options.ignoreConditions&&((req.headers['if-none-match']==='*'&&prior)||(req.headers['if-match']&&req.headers['if-match']!==tag))){res.writeHead(412);res.end();return}
  const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c))
  if(req.method==='MKCOL'){res.writeHead(201);res.end();return}
  if(req.method==='PUT'){const b=Buffer.concat(chunks);files.set(path,b);res.writeHead(prior?204:201,{ETag:etag(b)});res.end();return}
  if(req.method==='DELETE'){if(!prior){res.writeHead(404);res.end();return}files.delete(path);res.writeHead(204);res.end();return}
  if(req.method==='PROPFIND'){
   const entries=[...files.entries()].filter(([p])=>p.startsWith(path));
   const rows=entries.map(([p,b])=>`<d:response><d:href>${encodeURI(p)}</d:href><d:propstat><d:prop><d:getetag>${etag(b)}</d:getetag><d:getcontentlength>${b.length}</d:getcontentlength><d:resourcetype/></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join('')
   res.writeHead(207,{'Content-Type':'application/xml',...(options.truncated?{'X-AIA-Incomplete':'true'}:{})});res.end(`<d:multistatus xmlns:d="DAV:">${rows}</d:multistatus>`);return
  }
  if(!prior){res.writeHead(404);res.end();return}
  res.writeHead(200,{ETag:tag!,'Content-Length':prior.length});res.end(req.method==='HEAD'?undefined:prior)
 })
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r))
 const addr=server.address();if(!addr||typeof addr==='string')throw Error('missing address')
 return {url:`http://127.0.0.1:${addr.port}/dav/`,files,get requests(){return requests},close:()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
}
