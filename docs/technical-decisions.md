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

GitHub适配器按不可变commit读取真实tree SHA，发布仅force:false快进；提交存在与当前分支内容一致分别回执。上传blob按流式base64与Git blob SHA核对，未变更不创建提交。参考：https://docs.github.com/en/rest/git/refs#update-a-reference 、https://docs.github.com/en/rest/git/trees#get-a-tree 。真实账号验收待配置，不以合成HTTP服务替代。

同步恢复先读回各端与本机、补确认已达目标的旧操作，其他旧批次被替代后统一重算，不直接重放旧发布。冲突候选身份取单文件版本，避免无关文件改变使选择失效；选择与手动同步串行。已知冲突在参与方未知时继续冻结该路径。关窗隐藏到菜单栏；退出停止调度，排空已提交IPC、本机事务、同步检查点，释放真实路径锁。尚未档案接入时只比较不发布；恢复冻结同样不能被手动按钮绕过。

备份用 manifest.json、archive/ 与 state/ 两个命名空间；state/ 内保留相对用户状态目录的路径（例如 state/state/objects）。只按白名单收集状态，不递归整个用户状态根目录，避免重复打包默认archive子目录或凭据。设置仅生成脱敏、禁用、未验证副本。冻结覆盖IPC、调度、菜单栏、监听；附件、草稿和导入身份映射也在门内。ZIP逐项哈希/长度与路径冲突验证，输出原子替换；外部编辑变化则失败。恢复到独立新目录，旧请求隔离、发布冻结、重设就绪；当前工作区由独立workspace位置设置切换，更新程序不覆盖个人档案。
