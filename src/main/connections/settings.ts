import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { z } from 'zod'
import { atomicWrite, readMaybe } from '../archive/transactions'
import type { ConnectionState, EndpointState, EndpointId, PublicConnectionConfig, ConfigureConnection } from '../../shared/connections'
import { CredentialVault } from './credential-vault'
import { validateEndpoint, probeWebdav, probeGithub } from './probe-service'
export const ConnectionInputSchema = z.discriminatedUnion('id', [z.object({ id: z.literal('webdav'), url: z.url(), username: z.string().min(1), secret: z.string().min(1).max(8192).optional() }), z.object({ id: z.literal('github'), owner: z.string().regex(/^[\w.-]+$/), repo: z.string().regex(/^[\w.-]+$/), branch: z.string().min(1).max(255), secret: z.string().min(1).max(8192).optional() })])
type InternalEndpoint = Omit<EndpointState, 'credentialStored'> & { credentialKey?: string }
interface StoredSettings { schemaVersion: 1; endpoints: Record<EndpointId, InternalEndpoint> }
const blank = (id: EndpointId): InternalEndpoint => ({ id, enabled: false, config: null, status: 'not_configured', verifiedAt: null, revision: 0 })
export class ConnectionService {
  private value: StoredSettings = { schemaVersion: 1, endpoints: { webdav: blank('webdav'), github: blank('github') } }
  private tail: Promise<unknown> = Promise.resolve()
  private listeners = new Set<() => void>();private unreadSettings:Buffer|null=null;private warning:string|undefined
  constructor(private root: string, private vault: CredentialVault, private allowTestHTTP = false) {}
  private path() { return join(this.root, 'settings/connections.json') }
  async open() { const bytes=await readMaybe(this.path());if(!bytes)return;try{const value=JSON.parse(bytes.toString()) as StoredSettings;if(value.schemaVersion!==1||!value.endpoints?.webdav||!value.endpoints?.github)throw Error('Invalid settings');for(const id of ['webdav','github']as const){const e=value.endpoints[id];if(e.id!==id||typeof e.enabled!=='boolean'||!Number.isSafeInteger(e.revision)||e.revision<0||!['not_configured','configured','verified','error','disabled'].includes(e.status))throw Error('Invalid endpoint');if(e.config){const c=ConnectionInputSchema.parse(e.config);if(c.id!==id)throw Error('Invalid identity');e.config=c.id==='webdav'?{id:c.id,url:c.url,username:c.username}:{id:c.id,owner:c.owner,repo:c.repo,branch:c.branch}}}this.value=value}catch{this.unreadSettings=bytes;this.warning='连接设置无法读取，云端已停用；原文件已保留，本机档案仍可使用。请重新配置连接。'}}
  private queue<T>(work: () => Promise<T>): Promise<T> { const next = this.tail.then(work); this.tail = next.catch(() => {}); return next }
  private async publish(id: EndpointId, endpoint: InternalEndpoint) { if(this.unreadSettings){await atomicWrite(join(this.root,'settings','connections.unreadable-'+randomUUID()+'.json'),this.unreadSettings);this.unreadSettings=null}const next = { ...this.value, endpoints: { ...this.value.endpoints, [id]: endpoint } }; await atomicWrite(this.path(), JSON.stringify(next)); this.value = next; for(const listener of this.listeners)listener() }
  onChange(listener:()=>void){this.listeners.add(listener);return()=>this.listeners.delete(listener)}
  async getState(): Promise<ConnectionState> {
    const publicEndpoint = async (id: EndpointId): Promise<EndpointState> => { const { credentialKey, ...e } = this.value.endpoints[id]; return { ...e, status: e.enabled ? e.status : e.config ? 'disabled' : 'not_configured', credentialStored: !!credentialKey && await this.vault.has(credentialKey) } }
    return { schemaVersion: 1, ...(this.warning?{warning:this.warning}:{}),endpoints: { webdav: await publicEndpoint('webdav'), github: await publicEndpoint('github') } }
  }
  async export() { return this.getState() }
  configure(input: ConfigureConnection) { return this.queue(async () => {
    const p = ConnectionInputSchema.parse(input), prior = this.value.endpoints[p.id]
    if (p.id === 'webdav') validateEndpoint(p.url, this.allowTestHTTP)
    const config: PublicConnectionConfig = p.id === 'webdav' ? { id: p.id, url: p.url, username: p.username } : { id: p.id, owner: p.owner, repo: p.repo, branch: p.branch }
    let credentialKey = prior.credentialKey
    if (p.secret !== undefined) { credentialKey = prior.credentialKey ? p.id + '-' + randomUUID() : p.id; await this.vault.set(credentialKey, p.secret) }
    if (!credentialKey || !await this.vault.has(credentialKey)) throw Error('请填写连接凭据')
    if (prior.enabled && p.secret === undefined && JSON.stringify(prior.config) === JSON.stringify(config)) return this.getState()
    await this.publish(p.id, { id: p.id, enabled: true, config, credentialKey, status: 'configured', verifiedAt: null, revision: prior.revision + 1 })
    return this.getState()
  }) }
  setEnabled(id: EndpointId, enabled: boolean) { return this.queue(async () => { const prior = this.value.endpoints[id]; if (enabled && !prior.config) throw Error('请先配置该连接'); await this.publish(id, { ...prior, enabled }); return this.getState() }) }
  async client(id: EndpointId) { const endpoint = this.value.endpoints[id]; if (!endpoint.enabled || !endpoint.config || !endpoint.credentialKey) return null; const secret = await this.vault.get(endpoint.credentialKey); if (!secret) throw Error('连接凭据不可用'); return { ...endpoint.config, secret, revision: endpoint.revision, capabilities: endpoint.capabilities, apiBase:this.allowTestHTTP?process.env.AIA_TEST_GITHUB_API_BASE:undefined,...(this.allowTestHTTP ? { allowTestHTTP: true } : {}) } }
  test(id: EndpointId) { return this.queue(async () => {
    const prior = this.value.endpoints[id]; if (!prior.enabled) throw Error('请先启用连接')
    try {
      const client = await this.client(id); if (!client) throw Error('请先配置连接')
      if (client.id === 'webdav') {
        const capabilities = await probeWebdav({ url: client.url, username: client.username, secret: client.secret, allowTestHTTP: this.allowTestHTTP })
        const verified = capabilities.authenticated && capabilities.conditionalWrite && capabilities.conditionalDelete && capabilities.createOnly && capabilities.unicodePaths && capabilities.completeListing
        await this.publish(id, { ...prior, capabilities, status: verified ? 'verified' : 'error', verifiedAt: verified ? capabilities.verifiedAt : null, error: verified ? undefined : capabilities.authenticated ? '连接可用，但安全同步能力尚未验证通过' : '验证失败：认证或权限被拒绝' })
      } else {
        const github = await probeGithub({ owner: client.owner, repo: client.repo, branch: client.branch, token: client.secret,apiBase:client.apiBase })
        await this.publish(id, { ...prior, github, status: github.writable ? 'verified' : 'error', verifiedAt: github.writable ? new Date().toISOString() : null, error: github.writable ? undefined : '验证失败：该仓库缺少写入权限' })
      }
    } catch { await this.publish(id, { ...prior, status: 'error', verifiedAt: null, error: '验证失败：请核对网络、地址、账号权限和应用密码。' }) }
    return this.getState()
  }) }
}
