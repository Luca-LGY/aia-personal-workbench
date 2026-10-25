import { createServer } from 'node:http'
import { digest } from '../../src/main/sync/graph'
export async function fakeWebdav(options: { pageSize?: number; omitNext?: boolean; weakETags?: boolean; omitETags?: boolean; truncated?: boolean; authStatus?: number; losePutReplyOnce?: boolean;listedSizeOffset?:number;afterList?:(context:{path:string;page:number})=>void; statusOnce?: { method: string; status: number; retryAfter?: string } } = {}) {
  const files = new Map<string, Buffer>(), dirs = new Set(['/dav/']), requests: { method: string; path: string; ifMatch?: string; ifNoneMatch?: string; depth?: string }[] = []
  let url = '', active = 0, maxConcurrent = 0
  const tag = (b: Buffer) => (options.weakETags ? 'W/' : '') + '"' + digest(b) + '"'
  const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  const href = (s: string) => escape(s.split('/').map(encodeURIComponent).join('/'))
  const seed = (path: string, value: string | Buffer) => { const full = '/dav/' + path, parts = full.split('/'); for (let i = 2; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/') + '/'); files.set(full, Buffer.from(value)) }
  const server = createServer(async (req, res) => {
    active++; maxConcurrent = Math.max(maxConcurrent, active)
    try {
      const u = new URL(req.url!, 'http://127.0.0.1'), path = decodeURIComponent(u.pathname), method = req.method!
      requests.push({ method, path, ifMatch: req.headers['if-match'] as string | undefined, ifNoneMatch: req.headers['if-none-match'] as string | undefined, depth: req.headers.depth as string | undefined })
      if (options.authStatus) { res.writeHead(options.authStatus); res.end(); return }
      if (options.statusOnce?.method === method) { const s = options.statusOnce; options.statusOnce = undefined; res.writeHead(s.status, s.retryAfter ? { 'Retry-After': s.retryAfter } : {}); res.end(); return }
      const prior = files.get(path), etag = prior ? tag(prior) : undefined
      if ((req.headers['if-none-match'] === '*' && prior) || (req.headers['if-match'] && (req.headers['if-match'] !== etag || etag?.startsWith('W/')))) { res.writeHead(412); res.end(); return }
      if (method === 'MKCOL') { if (dirs.has(path)) res.writeHead(405); else { dirs.add(path); res.writeHead(201) } res.end(); return }
      if (method === 'PROPFIND') {
        if (!dirs.has(path)) { res.writeHead(404); res.end(); return }
        const children: {path:string;directory:boolean;bytes:Buffer}[] = [...dirs].filter(p => p !== path && p.startsWith(path) && !p.slice(path.length).replace(/\/$/, '').includes('/')).map(p => ({ path: p, directory: true, bytes: Buffer.alloc(0) }))
        children.push(...[...files].filter(([p]) => p.startsWith(path) && !p.slice(path.length).includes('/')).map(([p, bytes]) => ({ path: p, directory: false, bytes })))
        children.sort((a, b) => a.path.localeCompare(b.path))
        const page = Number(u.searchParams.get('page') ?? 1), size = options.pageSize ?? 750, selected = children.slice((page - 1) * size, page * size), next = page * size < children.length
        const rows = [{ path, directory: true, bytes: Buffer.alloc(0) }, ...selected].map(f => `<d:response><d:href>${href(f.path)}</d:href><d:propstat><d:prop><d:resourcetype>${f.directory ? '<d:collection/>' : ''}</d:resourcetype>${!f.directory && !options.omitETags ? '<d:getetag>' + escape(tag(f.bytes)) + '</d:getetag>' : ''}<d:getcontentlength>${f.bytes.length+(f.directory?0:options.listedSizeOffset??0)}</d:getcontentlength></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join('')
        res.writeHead(207, { 'Content-Type': 'application/xml', ...(next && !options.omitNext ? { Link: `<${url + path.slice('/dav/'.length).split('/').map(encodeURIComponent).join('/')}?page=${page + 1}>; rel="next"` } : {}) })
        res.end(`<d:multistatus xmlns:d="DAV:">${rows}${options.truncated ? '' : '</d:multistatus>'}`);options.afterList?.({path,page}); return
      }
      if (method === 'PUT') { const chunks: Buffer[] = []; for await (const c of req) chunks.push(Buffer.from(c)); const bytes = Buffer.concat(chunks); files.set(path, bytes); if (options.losePutReplyOnce) { options.losePutReplyOnce = false; req.socket.destroy(); return } res.writeHead(prior ? 204 : 201, options.omitETags ? {} : { ETag: tag(bytes) }); res.end(); return }
      if (method === 'DELETE') { if (prior) { files.delete(path); res.writeHead(204) } else if (dirs.has(path) && ![...files.keys()].some(p => p.startsWith(path))) { dirs.delete(path); res.writeHead(204) } else res.writeHead(404); res.end(); return }
      if (!prior) { res.writeHead(404); res.end(); return }
      res.writeHead(200, { ...(options.omitETags ? {} : { ETag: etag! }), 'Content-Length': prior.length }); res.end(method === 'HEAD' ? undefined : prior)
    } finally { active-- }
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r)); const address = server.address(); if (!address || typeof address === 'string') throw Error('No server address'); url = `http://127.0.0.1:${address.port}/dav/`
  return { url, files, dirs, requests, options, seed, get maxConcurrent() { return maxConcurrent }, close: () => new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())) }
}
