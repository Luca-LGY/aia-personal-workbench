import { join } from 'node:path'
import { unlink } from 'node:fs/promises'
import { atomicWrite, readMaybe } from '../archive/transactions'
export interface SecureStorage { isAsyncEncryptionAvailable(): Promise<boolean>; encryptStringAsync(value: string): Promise<Buffer>; decryptStringAsync(bytes: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }> }
export class CredentialVault {
  constructor(private root: string, private storage: SecureStorage) {}
  private path(key: string) { if (!/^(webdav|github)(-[a-f0-9-]{36})?$/.test(key)) throw Error('Invalid credential key'); return join(this.root, 'credentials', key + '.bin') }
  private async available() { if (!await this.storage.isAsyncEncryptionAvailable()) throw Error('系统加密暂不可用，请稍后重试；本机档案仍可使用。') }
  async set(key: string, secret: string) { const path = this.path(key); await this.available(); let bytes: Buffer; try { bytes = await this.storage.encryptStringAsync(secret) } catch { throw Error('系统加密失败，请稍后重试。') } if (!bytes.length) throw Error('系统加密失败'); await atomicWrite(path, bytes) }
  async get(key: string) { const bytes = await readMaybe(this.path(key)); if (!bytes) return null; await this.available(); try { const value = await this.storage.decryptStringAsync(bytes); if (value.shouldReEncrypt) await this.set(key, value.result); return value.result } catch { throw Error('凭据解密暂不可用，请重新连接或稍后重试。') } }
  async has(key: string) { return !!await readMaybe(this.path(key)) }
  async remove(key: string) { const path = this.path(key); if (await readMaybe(path)) await unlink(path) }
}
