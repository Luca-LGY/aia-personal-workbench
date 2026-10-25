import { randomUUID } from 'node:crypto'
import { XMLParser } from 'fast-xml-parser'
import type { WebdavConfig,CapabilityReport,GithubConfig } from '../../shared/connections'
export function validateEndpoint(url:string,allowTestHTTP=false){const u=new URL(url);if(u.protocol!=='https:'&&!(allowTestHTTP&&u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error('HTTPS is required');if(u.username||u.password)throw Error('Credentials must not be embedded in URL');return u}
export async function probeWebdav(c:WebdavConfig):Promise<CapabilityReport>{
 const base=validateEndpoint(c.url,c.allowTestHTTP);if(!base.pathname.endsWith('/'))base.pathname+='/'
 const root=new URL(`AIA-Probe-${randomUUID()}/`,base),file=new URL(encodeURIComponent('测试# 空格.txt'),root)
 const report:CapabilityReport={authenticated:false,conditionalWrite:false,conditionalDelete:false,createOnly:false,unicodePaths:false,completeListing:false,verifiedAt:new Date().toISOString(),issues:[]}
 const headers={Authorization:'Basic '+Buffer.from(c.username+':'+c.secret).toString('base64')}
 const request=(u:URL,method:string,extra:Record<string,string>={},body?:string)=>fetch(u,{method,headers:{...headers,...extra},body,signal:AbortSignal.timeout(15000)})
 let created=false
 try{
  const mk=await request(root,'MKCOL');if(mk.status===401||mk.status===403){report.issues.push('Authentication or permission rejected');return report}if(!mk.ok)throw Error('Probe directory creation failed: '+mk.status)
  created=true;report.authenticated=true
  const initial=await request(file,'PUT',{'If-None-Match':'*'},'probe-original');if(!initial.ok)throw Error('Probe creation failed')
  report.unicodePaths=(await (await request(file,'GET')).text())==='probe-original'
  report.createOnly=(await request(file,'PUT',{'If-None-Match':'*'},'must-not-overwrite')).status===412
  await request(file,'PUT',{},'probe-original')
  const head=await request(file,'HEAD'),tag=head.headers.get('etag')
  if(!tag||tag.startsWith('W/'))report.issues.push('Strong ETag unavailable')
  const wrongPut=await request(file,'PUT',{'If-Match':'"not-current"'},'must-not-write')
  report.conditionalWrite=!!tag&&!tag.startsWith('W/')&&wrongPut.status===412&&(await(await request(file,'GET')).text())==='probe-original'
  const wrongDelete=await request(file,'DELETE',{'If-Match':'"not-current"'})
  report.conditionalDelete=wrongDelete.status===412&&(await request(file,'HEAD')).status===200
  if((await request(file,'HEAD')).status!==200)await request(file,'PUT',{},'probe-original')
  const listing=await request(root,'PROPFIND',{Depth:'1'}),xml=new XMLParser({removeNSPrefix:true}).parse(await listing.text())
  const rows=xml?.multistatus?.response;const entries=Array.isArray(rows)?rows:rows?[rows]:[]
  report.completeListing=listing.status===207&&listing.headers.get('x-aia-incomplete')!=='true'&&entries.length<750&&entries.some((r:{href?:string})=>r.href&&decodeURIComponent(r.href).includes('测试# 空格.txt'))
  if(!report.conditionalWrite||!report.conditionalDelete||!report.createOnly)report.issues.push('Conditional mutation safety not verified')
  return report
 }finally{if(created){const head=await request(file,'HEAD');if(head.ok)await request(file,'DELETE',head.headers.get('etag')?{'If-Match':head.headers.get('etag')!}:{});await request(root,'DELETE')}}
}
export async function probeGithub(c:GithubConfig){
 const base=c.apiBase??'https://api.github.com';validateEndpoint(base,base.startsWith('http://127.0.0.1:'))
 const headers={Authorization:`Bearer ${c.token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'}
 const repo=await fetch(`${base}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`,{headers,signal:AbortSignal.timeout(15000)})
 if(!repo.ok)throw Error(`GitHub authorization failed: ${repo.status}`)
 const meta=await repo.json() as {private:boolean;permissions?:{push?:boolean}}
 const ref=await fetch(`${base}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/git/ref/heads/${encodeURIComponent(c.branch)}`,{headers,signal:AbortSignal.timeout(15000)})
 if(!ref.ok)throw Error(`GitHub branch unavailable: ${ref.status}`)
 return {private:meta.private,writable:!!meta.permissions?.push,head:((await ref.json())as {object:{sha:string}}).object.sha}
}
