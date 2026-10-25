import { test,expect } from 'vitest'
import { queryParts } from '../../src/main/indexing/query'
test('user text is a literal parameter, not SQL or LIKE syntax',()=>{const p=queryParts({query:"x%' OR 1=1 --_",limit:20});expect(p.params.some(x=>String(x).includes("x\\%' OR 1=1 --\\_"))).toBe(true);expect(p.where).not.toContain('OR 1=1');expect(()=>queryParts({query:'x',limit:-1})).toThrow()})
