import { describe,test,expect } from 'vitest'
import { fakeCloud } from '../helpers/fake-cloud'
import { probeWebdav } from '../../src/main/connections/probe-service'
describe('WebDAV protocol capabilities',()=>{
 test('verifies conditions, readback and unicode against a real HTTP server',async()=>{const c=await fakeCloud();try{const r=await probeWebdav({url:c.url,username:'test',secret:'test',allowTestHTTP:true});expect(r.conditionalWrite).toBe(true);expect(r.conditionalDelete).toBe(true);expect(r.createOnly).toBe(true);expect(r.unicodePaths).toBe(true);expect(r.completeListing).toBe(true);expect(c.files.size).toBe(0)}finally{await c.close()}})
 test('detects a server that ignores preconditions rather than pretending safe',async()=>{const c=await fakeCloud({ignoreConditions:true});try{const r=await probeWebdav({url:c.url,username:'test',secret:'test',allowTestHTTP:true});expect(r.conditionalWrite).toBe(false);expect(r.createOnly).toBe(false)}finally{await c.close()}})
 test('incomplete listing is never complete',async()=>{const c=await fakeCloud({truncated:true});try{expect((await probeWebdav({url:c.url,username:'test',secret:'test',allowTestHTTP:true})).completeListing).toBe(false)}finally{await c.close()}})
 test('authentication failure does not retry credentials',async()=>{const c=await fakeCloud({unauthorized:true});try{const r=await probeWebdav({url:c.url,username:'test',secret:'test',allowTestHTTP:true});expect(r.authenticated).toBe(false);expect(c.requests).toBe(1)}finally{await c.close()}})
 test('plain HTTP outside explicit local testing is rejected before requests',async()=>{await expect(probeWebdav({url:'http://example.com/',username:'x',secret:'x'})).rejects.toThrow('HTTPS')})
})
