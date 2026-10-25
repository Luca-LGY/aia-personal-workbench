# 技术裁定

## 凭据保存（T17）

Electron 45 使用 `isAsyncEncryptionAvailable`、`encryptStringAsync`、`decryptStringAsync`。已核对锁定版本声明与 [官方 safeStorage 文档](https://www.electronjs.org/docs/latest/api/safe-storage)。不可用时不降级明文；renderer仅接受输入，不提供读取凭据的方法。普通导出不含密文或凭据引用。

配置切换使用不可变凭据版本：先保存新密文，再原子切换公开配置与引用。中途退出不会把新密码配给旧地址。旧密文保留在本机凭据目录，完整备份默认排除该目录。

APP使用独立的 `AIA-Workbench` 用户数据目录，测试使用临时独立目录。主库接入与旧后台交接留到T23，通过备份、校验和发布保护后进行。
