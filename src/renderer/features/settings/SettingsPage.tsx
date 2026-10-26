import { useEffect, useState } from 'react'
import type { RuntimeInfo } from '../../../shared/api'
import { ConnectionsPanel } from './ConnectionsPanel'
import { SyncDetails } from './SyncDetails'
import { BackupPanel } from './BackupPanel'
import { errorText } from '../../hooks'
export function SettingsPage({ notify }: { notify: (s: string) => void }) {
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null), [busy, setBusy] = useState(false)
  useEffect(() => { window.aia.runtime().then(setRuntime).catch(e => notify(errorText(e))) }, [])
  async function rebuild() { setBusy(true); try { const r = await window.aia.search.rebuild(); notify(`已重建 ${r.documents} 份档案索引${r.complete ? '。' : '，部分文件需要核对。'}`) } catch (e) { notify(errorText(e)) } finally { setBusy(false) } }
  return <section className="page settings-page"><div className="page-title"><h2>数据与设置</h2><p>查看本机数据、管理连接和维护档案。</p></div><section className="local-storage"><h3>本机档案</h3><p className="file-location">{runtime?.archiveRoot ?? '正在读取档案位置…'}</p><p className="helper">记录和附件保存在这台电脑，云端连接失败时仍可继续使用。</p><button className="outline" disabled={busy} onClick={rebuild}>重建搜索索引</button></section><BackupPanel notify={notify}/><ConnectionsPanel notify={notify}/><SyncDetails notify={notify}/></section>
}
