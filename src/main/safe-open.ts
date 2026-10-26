import { shell } from 'electron'
import { extname } from 'node:path'
import { lstat } from 'node:fs/promises'
// Inspecting an archive must never execute scripts, apps, shortcuts, or active HTML.
const documents=new Set(['.md','.txt','.json','.csv','.yaml','.yml','.pdf','.png','.jpg','.jpeg','.gif','.webp','.heic','.docx','.xlsx','.pptx'])
export async function openArchiveDocument(path:string){if((await lstat(path)).isSymbolicLink())throw Error('不能直接打开符号链接');if(!documents.has(extname(path).toLowerCase())){shell.showItemInFolder(path);return}const error=await shell.openPath(path);if(error)throw Error(error)}
