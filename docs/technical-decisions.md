# 技术裁定

## 凭据保存（T17）

Electron 45 使用 `isAsyncEncryptionAvailable`、`encryptStringAsync`、`decryptStringAsync`。已核对锁定版本声明与 [官方 safeStorage 文档](https://www.electronjs.org/docs/latest/api/safe-storage)。不可用时不降级明文；renderer仅接受输入，不提供读取凭据的方法。普通导出不含密文或凭据引用。

配置切换使用不可变凭据版本：先保存新密文，再原子切换公开配置与引用。中途退出不会把新密码配给旧地址。旧密文保留在本机凭据目录，完整备份默认排除该目录。

APP使用独立的 `AIA-Workbench` 用户数据目录，测试使用临时独立目录。主库接入与旧后台交接留到T23，通过备份、校验和发布保护后进行。

## 三端历史与完整性（T18）

每端基线按archiveId及远端命名空间隔离；版本节点身份包含父版本与观察上下文，内容对象按SHA256共用。快照的根目录存在、完整性和单项存在分开。没有共同祖先、首次未知缺失、删改、旧副本复活或并发数组/二进制变动进入冲突。

准备发布前先保存并校验全部必需对象，再原子保存操作日志。回执与对应端基线在同一checkpoint中提交；被替代运行的迟到回执仅保留历史。本机扫描不完整时不推进未应用版本的本机head。

大对象允许通过已存对象哈希参与规划，无需一次全部载入内存。发布准备采用流式哈希核验；仅在设备号、inode、大小、纳秒mtime与ctime完全一致时复用本进程完整性结果，重启后重验。完整备份仍逐项校验。

坚果云协议核对参考[官方授权与限制](https://help.jianguoyun.com/?p=2064)、[WebDAV RFC4918](https://www.rfc-editor.org/rfc/rfc4918.html)及[坚果云官方Obsidian插件分页实现](https://github.com/nutstore/obsidian-nutstore-sync/blob/main/src/api/webdav.ts)。分页使用响应Link的next关系；是否可安全写入仍以真实账号能力探针为准。本APP预算300次/30分钟，不把客户端预算说成服务商配额。
