import ignore from 'ignore'
import { readMaybe } from './transactions'
import { safePath } from './paths'
export class ArchivePolicy{
 private rules=ignore()
 static async open(root:string){const policy=new ArchivePolicy();for(const path of ['.gitignore','.git/info/exclude']){try{const bytes=await readMaybe(await safePath(root,path));if(bytes){if(bytes.length>1024*1024)throw Error('忽略规则文件过大');policy.rules.add(bytes.toString())}}catch(e){if(!['ENOENT','ENOTDIR'].includes((e as NodeJS.ErrnoException).code??''))throw e}}return policy}
 excluded(path:string):string|null{const parts=path.split('/'),name=parts.at(-1)??'';if(parts.includes('.git'))return'Git历史与设备状态留在本机';if(parts.includes('__pycache__')||/\.py[co]$/.test(name))return'可再生缓存';if(['.DS_Store','Thumbs.db','Desktop.ini','同步状态.md'].includes(name))return'设备本机状态';if(/^\.env(?:\.|$)/i.test(name)||/\.(pem|key|p12|pfx)$/i.test(name))return'受保护的凭据文件';if(/(?:\.sw[op]|\.tmp)$/.test(name)||name.startsWith('~$')||name.startsWith('.aia-tmp-'))return'临时文件';if(parts[0]==='.aia'||path==='.gitignore')return null;return this.rules.ignores(path)?'现有档案忽略规则':null}
}
