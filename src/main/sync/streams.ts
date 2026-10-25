import { createHash, randomUUID } from 'node:crypto'
import { open, mkdir, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { safePath } from '../archive/paths'
export async function ingestObject(root: string, source: AsyncIterable<Uint8Array>, expectedHash?: string) {
  const dir = await safePath(root, 'state/objects'); await mkdir(dir, { recursive: true })
  const temp = join(dir, '.aia-tmp-' + randomUUID()), checksum = createHash('sha256'); const file = await open(temp, 'wx', 0o600); let size = 0, closed = false
  try {
    for await (const chunk of source) { checksum.update(chunk); size += chunk.byteLength; await file.writeFile(chunk) }
    await file.sync(); await file.close(); closed = true
    const hash = checksum.digest('hex'); if (expectedHash && hash !== expectedHash) throw Error('CORRUPT_DOWNLOAD')
    const target = await safePath(root, join('state/objects', hash)); await rename(temp, target)
    const directory = await open(dir, 'r'); try { await directory.sync() } finally { await directory.close() }
    return { hash, size }
  } catch (e) { if (!closed) await file.close().catch(() => {}); await unlink(temp).catch(() => {}); throw e }
}
export async function* responseChunks(body: ReadableStream<Uint8Array> | null): AsyncGenerator<Uint8Array> { if (!body) return; const reader = body.getReader();let finished=false; try { while (true) { const { done, value } = await reader.read(); if (done){finished=true;return} yield value } } finally { if(!finished)await reader.cancel().catch(()=>{});reader.releaseLock() } }
export interface SyncObjectStore { object(hash: string): Promise<Buffer>; objectPath(hash: string): Promise<string>; putObject(hash: string, bytes: Uint8Array): Promise<void>; ingest(source: AsyncIterable<Uint8Array>, expectedHash?: string): Promise<{ hash: string; size: number }>; hasObject(hash: string): Promise<boolean> }
