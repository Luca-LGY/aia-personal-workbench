import { test,expect } from 'vitest'
import { mkdtemp,readdir,readFile,rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ingestObject } from '../../src/main/sync/streams'
import { digest } from '../../src/main/sync/graph'
test('interrupted or wrong-hash download never exposes a completed object; successful stream retains all bytes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'aia-stream-'));try{
  async function* interrupted(){yield Buffer.from('partial');throw Error('SIMULATED_DISCONNECT')}
  await expect(ingestObject(root,interrupted())).rejects.toThrow('SIMULATED_DISCONNECT')
  expect(await readdir(join(root,'state/objects'))).toEqual([])
  async function* chunks(){yield Buffer.from('one');yield Buffer.alloc(0);yield Buffer.from('two')}
  await expect(ingestObject(root,chunks(),digest('different'))).rejects.toThrow('CORRUPT')
  expect(await readdir(join(root,'state/objects'))).toEqual([])
  const result=await ingestObject(root,chunks(),digest('onetwo'))
  expect(result.size).toBe(6);expect(await readFile(join(root,'state/objects',result.hash),'utf8')).toBe('onetwo')
 }finally{await rm(root,{recursive:true,force:true})}
})
