import { test, expect } from 'vitest'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CredentialVault } from '../../src/main/connections/credential-vault'
test('unavailable OS encryption rejects secret persistence without plaintext fallback', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aia-vault-')); try {
    const vault = new CredentialVault(root, { isAsyncEncryptionAvailable: async () => false, encryptStringAsync: async () => { throw Error('must not encrypt') }, decryptStringAsync: async () => { throw Error('must not decrypt') } })
    await expect(vault.set('webdav', 'TEST_ONLY_SECRET')).rejects.toThrow('加密')
    expect(await readdir(root)).toHaveLength(0)
  } finally { await rm(root, { recursive: true, force: true }) }
})
