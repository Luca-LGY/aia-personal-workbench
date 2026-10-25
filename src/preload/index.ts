import { contextBridge,ipcRenderer } from 'electron'
import type { AiaAPI } from '../shared/api'
const api:AiaAPI={runtime:()=>ipcRenderer.invoke('aia:runtime')}
contextBridge.exposeInMainWorld('aia',api)
