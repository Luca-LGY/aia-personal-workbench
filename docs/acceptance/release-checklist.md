# 本机候选版发布检查

版本：0.1.0；日期：2026-10-26；平台：macOS arm64；状态：本机候选版，真实云接入待验。

## 工具链与产物

- Node 24.22.1、npm 11.19.1、Electron 45.0.0；依赖由 package-lock.json 精确锁定。
- `package:mac` 先构建再打包，使用已安装的 Electron distribution，不额外下载另一份运行时。
- app ID：`local.aia.workbench`；应用：`dist/mac-arm64/我的工作台.app`；原生 `.node` 模块解包至 app.asar.unpacked。
- 本机个人目录包，未购买开发者签名／公证、未上传商店；普通 macOS 授权流程由本人操作。
- `.app` 实际启动测试已核对 app.isPackaged、asar 内主程序、file: 页面、SQLite，以及显式退出后同目录搜索／草稿／二进制附件 SHA；模拟系统加密不可用仍能本地保存，不降级为明文凭据。

## 阶段证据

- T23 全量门禁：42 unit、100 integration、31 Electron、typecheck/lint/build 全通过；日志 `/tmp/aia-t23-flushed-all.log`（临时日志，长期依据为同版本测试源码与此记录）。
- T24 缺少产物时 packaged-app 测试先失败；实际 `package:mac` 成功后该测试通过。
- 保存失败、比较列表、聊天落档边界、搜索筛选与填充视觉专项已加入强制测试；不使用 skip，也不增加旧测试时限。
- 最终全量门禁：42 unit、100 integration、37 Electron全部通过，typecheck、lint、构建、arm64打包退出0（`/tmp/aia-t24-all.log`）。完整命令 `caffeinate -i ./scripts/npmw run test:all`；仅测试期间避免系统自动休眠。
- 视觉对照及所有可检查证据见 visual-review.md、项目根 design-qa.md 和 A01-A24.md。

## 数据保护与真实验收边界

- 真实原档案未被本轮功能测试修改，原 Git 后台／LaunchAgent 未被暂停，佳明任务未被修改或重调度。
- 凭据留待用户在APP安全配置。真实 WebDAV 条件能力、真实 GitHub／坚果云互通、整库迁移、旧后台交接、真实佳明归档持续接回均待验。
- 自动化模拟通过不等于真实云验收；不宣称 PRD 所有首版必做项已经实际通过。
- 完整备份／独立恢复演练使用合成档案，通过后仍暂停发布；真实主库备份按接入步骤另做。
- 未推送代码、未创建云服务器／数据库、未部署网站或手机端。

基线校验：PRD.md SHA-256 `0ebd31987fb5a3ae2c38c7135033875a725c66c5ea74192ed64b78a79f6fcdce`；选图 SHA-256 `ff0d9dabe7543f746ad05c5b77609fbf88190443d087b77eb43ecc585f29d0ad`，均与原始交接一致。应用目录约322MB，dist为忽略的可重建本机产物。
