import { test, expect, vi } from 'vitest'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ConnectionService } from '../../src/main/connections/settings'
import { CredentialVault, type SecureStorage } from '../../src/main/connections/credential-vault'
import type { ConfigureConnection } from '../../src/shared/connections'
import { fakeGithub } from '../helpers/fake-github'
import { fakeCloud } from '../helpers/fake-cloud'

async function fixture(id: 'github' | 'webdav' = 'github') {
  const root = await mkdtemp(join(tmpdir(), 'aia-connection-settings-'))
  const key = randomBytes(32)
  const storage: SecureStorage = {
    isAsyncEncryptionAvailable: async () => true,
    encryptStringAsync: async value => {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv)
      return Buffer.concat([iv, cipher.update(value, 'utf8'), cipher.final(), cipher.getAuthTag()])
    },
    decryptStringAsync: async bytes => {
      const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12))
      decipher.setAuthTag(bytes.subarray(-16))
      return { result: Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString(), shouldReEncrypt: false }
    }
  }
  const vault = new CredentialVault(root, storage), service = new ConnectionService(root, vault, true)
  const github = id === 'github' ? await fakeGithub() : null, webdav = id === 'webdav' ? await fakeCloud() : null
  if (github) vi.stubEnv('AIA_TEST_GITHUB_API_BASE', github.url)
  const config: ConfigureConnection = github
    ? { id: 'github', owner: github.owner, repo: github.repo, branch: github.branch }
    : { id: 'webdav', url: webdav!.url, username: 'synthetic-user' }
  await service.open()
  await service.configure({ ...config, secret: 'SYNTHETIC_ENCRYPTED_CREDENTIAL' })
  const verified = (await service.test(id)).endpoints[id]
  expect(verified.status).toBe('verified')
  return { root, vault, service, config, verified, storage, close: async () => {
    await github?.close(); await webdav?.close(); vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true })
  } }
}

test.each(['github', 'webdav'] as const)('saving unchanged %s settings keeps verification, revision and ciphertext without notifying sync', async id => {
  const t = await fixture(id)
  try {
    const settings = await readFile(join(t.root, 'settings/connections.json'))
    const cipher = await readFile(join(t.root, 'credentials', id + '.bin'))
    expect(cipher.includes(Buffer.from('SYNTHETIC_ENCRYPTED_CREDENTIAL'))).toBe(false)
    let notifications = 0
    t.service.onChange(() => notifications++)
    const saved = await t.service.configure(t.config)
    expect(saved.endpoints[id]).toEqual(t.verified)
    expect(notifications).toBe(0)
    expect(await readFile(join(t.root, 'settings/connections.json'))).toEqual(settings)
    expect(await readFile(join(t.root, 'credentials', id + '.bin'))).toEqual(cipher)
    expect(await readdir(join(t.root, 'credentials'))).toEqual([id + '.bin'])
    expect((await t.service.client(id))?.secret).toBe('SYNTHETIC_ENCRYPTED_CREDENTIAL')
    const reopened = new ConnectionService(t.root, new CredentialVault(t.root, t.storage), true)
    await reopened.open()
    expect((await reopened.getState()).endpoints[id]).toEqual(t.verified)
  } finally { await t.close() }
})

test.each(['owner', 'repo', 'branch'] as const)('changing GitHub %s still invalidates verification', async field => {
  const t = await fixture()
  try {
    const saved = (await t.service.configure({ ...t.config, [field]: 'changed-target' })).endpoints.github
    expect(saved).toMatchObject({ status: 'configured', verifiedAt: null, revision: t.verified.revision + 1, enabled: true, credentialStored: true })
    expect(saved.github).toBeUndefined()
  } finally { await t.close() }
})

test('explicit credential replacement invalidates verification even with unchanged public settings', async () => {
  const t = await fixture()
  try {
    const saved = (await t.service.configure({ ...t.config, secret: 'SYNTHETIC_REPLACEMENT_CREDENTIAL' })).endpoints.github
    expect(saved).toMatchObject({ status: 'configured', verifiedAt: null, revision: t.verified.revision + 1 })
    expect(saved.github).toBeUndefined()
    expect((await t.service.client('github'))?.secret).toBe('SYNTHETIC_REPLACEMENT_CREDENTIAL')
  } finally { await t.close() }
})

test('unchanged settings cannot bypass a missing credential', async () => {
  const t = await fixture()
  try {
    await t.vault.remove('github')
    await expect(t.service.configure(t.config)).rejects.toThrow('请填写连接凭据')
    expect((await t.service.getState()).endpoints.github.credentialStored).toBe(false)
  } finally { await t.close() }
})

test('saving a disabled connection still re-enables it and requires verification', async () => {
  const t = await fixture()
  try {
    await t.service.setEnabled('github', false)
    const saved = (await t.service.configure(t.config)).endpoints.github
    expect(saved).toMatchObject({ enabled: true, status: 'configured', verifiedAt: null, revision: t.verified.revision + 1 })
  } finally { await t.close() }
})
