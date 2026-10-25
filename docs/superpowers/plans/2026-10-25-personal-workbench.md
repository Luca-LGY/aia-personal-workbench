# 个人工作生活 APP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 PRD 交付可在当前 Mac 使用的个人工作生活 APP，具备可靠本机档案、自然语言归档、十个页面、全局搜索、佳明档案读取、坚果云与 GitHub 双向同步及完整恢复能力。

**Architecture:** Electron 主进程负责文件、索引、凭据和同步，React 渲染进程负责已确认的暖白松绿界面，通过受限类型化 IPC 通信。Markdown／JSON／附件是档案本体，SQLite 仅保存可重建查询投影；事务日志、同步基线和冲突正文另行持久保存。两端通过一个协调器同步同一份本机档案，原后台先审计、最后接管，佳明原采集不改。

**Tech Stack:** 建议采用 Electron、React、TypeScript、electron-vite、Node.js 24 LTS、better-sqlite3、Zod、YAML、Chokidar、Vitest、Playwright Electron、electron-builder。样式使用本地 CSS 变量和 Lucide 图标；不引入云数据库或付费模型作为必要依赖。

**Spec:** [PRD.md](../../../PRD.md)；视觉基准为 [已选首页图](../../../design/home-selected-warm-white-pine.png)。PRD 的功能与数据真实性要求优先于图片中的示例占位内容。

日期：2026-10-25，Asia/Shanghai。本文是待执行计划，所有任务初始未完成；本轮没有安装依赖、搭建工程、修改原档案或连接云端。

## Global Constraints

- 首版“优先稳定、数据不丢、操作直接和免费使用”；已保存内容在“刷新页面、关闭 APP、重新启动后”保留。
- 导航严格为：首页总览、快速寻找、今日计划、学习数据、科研实验、运动计划、饮食计划、游戏娱乐、开发工作、数据与设置，十个同级入口。
- “每日记录”不作为首版侧栏入口；既有 `每日记录/学习数据/` 和 `每日记录/科研实验/` 不因导航改变而搬迁。
- 沿用“随手归档”布局与“暖白松绿”配色；真实界面不预填截图中的早餐或学习／实验示例。
- 坚果云为主通道，GitHub 为第二通道但仍双向；支持任一通道单独运行。
- 本机保存、查看、编辑和关键词搜索可离线；启动先读取本机，再检查远端。
- 自然语言基本整理是首版必做；保留原文、区分事实与计划、支持修改和待整理，不补造数量、营养、时长或实验结论。
- 佳明只接已有 MCP 流程实际产出的归档，不创建截图流程、重复采集任务或新的 Garmin 写入功能。
- 科目采用用户未来提供的 Obsidian 分类；不把 ODE／PDE 当完整目录，不把科研前置资料放进学习。
- 不实现多人账号、移动客户端、托管服务器、食物识别或监听全部聊天；只有实际落档的外部内容参与同步。
- 真实主库、账户配置和原后台在 T23 前保持只读；测试、演示、生产数据位置独立。
- 每个任务只改列明文件及必要相邻类型；依赖精确锁定，本机阶段性提交，不默认创建远端代码仓库或推送。

## Review Focus

1. 保存到一半被终止或磁盘写失败：重启能恢复事务，输入与原文不丢，不能假报本机成功。责任任务 T04。
2. 中文正文、两字／单字、符号和外部改名：能搜到具体来源，重复 ID／坏元数据不导致旧档案被改写。责任任务 T05、T06。
3. 三端同时修改、删改冲突、回执丢失：保存所有候选，拒绝失效条件写入，重启只补未完成工作。责任任务 T18–T21。
4. 云端列举不完整、鉴权失效、限流或额度不足：不能把遗漏文件当删除，停止错误认证重试、保留队列和各端成功时间。责任任务 T02、T19–T21。
5. 恢复损坏／旧备份，或源文件路径逃出档案：拒绝危险路径、保护当前数据、冻结旧数据发布并展示差异。责任任务 T04、T22。

## 1. 实施决策与现状

### 1.1 本计划采用的默认实现

这些是为了可执行性作出的技术建议，不是用户曾指定的框架。执行时按此基线推进；遇到依赖或协议实测不成立，应记录证据并调整相关技术决策，不削减 PRD 必做功能。

| 决策 | 默认实现和理由 |
| --- | --- |
| 运行形式 | 本机 Electron 桌面 APP；网页式界面便于贴合选图，主进程可直接处理文件和云端请求；接受安装包体积较大的代价 |
| 工具链 | Node 24 LTS、npm 和锁文件；当前 shell 无全局 node/npm，但已核对 Codex 附带 Node 为 v24.22.1。T01 配置可重复使用的项目工具链，不依赖每次会话猜 PATH |
| 数据本体 | 新业务记录使用带稳定元数据的 Markdown，原始 JSON 和附件按原路径保留；不以 SQLite 或 localStorage 作为唯一原件 |
| 索引 | better-sqlite3；中文首版使用参数化子串查询，字段筛选与分页。先保证一字、两字和特殊字符正确；不把 FTS 默认分词当成中文全文搜索已经完成 |
| 自然语言 | 免费确定性规则优先，明确句可自动整理；复杂句保存原文并待整理。可选模型接口只留边界，不要求本地大模型下载或付费 API |
| 同步 | GitHub REST Git Data API＋WebDAV，统一状态机；每端独立基线，内容哈希与版本祖先用于合并，条件写入用于保护并发 |
| 身份与凭据 | 使用 Electron 主进程的 OS 加密能力保存应用凭据；不假定 Codex 连接或 ChatGPT 登录能被 APP 自动继承 |
| 窗口行为 | 关闭窗口隐藏到菜单栏，主进程继续同步；显式“退出 APP”才停止，下次启动补同步。T23 沿用已审计的登录启动意图，不重复创建后台；对关窗／退出／关机分别说明 |
| 备份 | 手动完整 ZIP＋清单／哈希；重大迁移和恢复前快照。自动定时保留策略不作为已确认功能擅自添加 |

Electron 的主进程／渲染进程与隔离机制见[官方进程说明](https://www.electronjs.org/docs/latest/tutorial/process-model)和[上下文隔离](https://www.electronjs.org/docs/latest/tutorial/context-isolation)。electron-vite 的入口和构建配置按[维护方指南](https://electron-vite.org/guide/)实施。

### 1.2 分阶段可交付结果

| 里程碑 | 任务 | 阶段完成后实际可用的能力 |
| --- | --- | --- |
| M0 风险核对 | T00–T02 | 主库／后台清单、可启动工具链、独立测试端协议探针；未提供凭据的实测项明确待验证 |
| M1 本机闭环 | T03–T08 | 本机可靠档案、外部文件索引、暖白松绿首页、随手记真实归档、关键词搜索 |
| M2 领域功能 | T09–T16 | 今日计划与六个领域模块、佳明档案读取、可追溯周报和基础训练安排分析 |
| M3 同步闭环 | T17–T21 | 账户设置、模拟与测试端双向同步、冲突／删除／断网重启补传、首页真实状态 |
| M4 数据交付 | T22–T24 | 完整恢复、整库迁移、原后台交接、真实账户接入验证和可启动 Mac 应用包 |

依赖顺序：T03→T04→T05→T06；T07 使用 T04/T06，T08 使用 T03/T04/T07；T09 之后 T10–T14 可分开开发；T15→T16。T17 可在 M2 时并行；T18 与 T19/T20 可在共享接口冻结后并行；T21 汇合；T22 和 T21 都通过后才进入 T23。M1–M3 都不等于整版交付。

## 2. 文件与数据边界

### 2.1 将创建的工程文件

执行时才创建以下文件；本轮只创建本计划文档。模块各自负责页面和领域逻辑，共用组件只包含外观和通用输入，不统一领域模型。

```text
package.json / package-lock.json / electron.vite.config.ts
tsconfig*.json / vitest.config.ts / playwright.config.ts
electron-builder.yml / .gitignore / .nvmrc
scripts/setup-node.sh / scripts/npmw
src/shared/                  # models.ts、schemas.ts、api.ts、sync.ts、connections.ts
src/main/index.ts            # 应用生命周期、单实例、测试模式隔离
src/main/services.ts         # 服务装配和生命周期，不含领域业务
src/main/tray.ts             # 菜单栏打开／状态／显式退出
src/main/ipc.ts              # 唯一 IPC 注册与输入校验
src/main/archive/            # paths、codec、repository、transactions、attachments、importer、watcher
src/main/indexing/           # database、search、projection
src/main/capture/            # parser、service
src/main/plans/              # service
src/main/modules/            # learning、research、diet、games、development
src/main/garmin/             # reader、normalizer
src/main/reports/            # weekly、training、overview
src/main/connections/        # probe-service、credential-vault、settings
src/main/sync/               # graph、planner、journal、coordinator、scheduler、migration
src/main/sync/adapters/      # webdav、github
src/main/backup/             # manifest、exporter、restorer
src/preload/index.ts
src/renderer/                # App.tsx、styles/tokens.css、styles/layout.css
src/renderer/components/    # AppShell、RecordDetail、SourceLink、SaveState
src/renderer/features/      # home、search、plans、learning、research、sports、diet、games、development、settings
tests/unit/ / tests/integration/ / tests/electron/
tests/fixtures/              # 全部为明确标识的测试档案，禁止混入主库
docs/audit/ / docs/acceptance/ / docs/technical-decisions.md
```

### 2.2 三类本机存储

1. **用户档案目录**：由用户选择或新建，独立于 APP 工程。原档案不改结构；新记录写入明确登记的领域目录。新记录 Markdown 的元数据含 `aia_id/schemaVersion/kind/module/role/date/createdAt/updatedAt/sourceRefs`，类型字段放 `data`，正文保留可读原文。科目、课题、游戏、项目也是有 ID 的记录。`.aia/catalog.json` 保存 archiveId／schemaVersion，`.aia/identities/` 保存旧文件映射，`.aia/tombstones/` 保存删除身份；这些共享元数据纳入同步清单。
2. **APP 本机状态目录**：`app.getPath('userData')/archives/<archiveId>/`。`state/transactions/` 是未完成文件事务；`state/sync/` 是各端基线、版本图、队列和回执；`state/objects/<sha256>` 保存必要基线／冲突正文。它们不是可丢缓存，纳入完整备份。凭据密文在单独 `credentials/`，默认不进入备份。不同电脑不得复制设备身份并直接续发旧队列。
3. **可重建缓存**：同目录的 `cache/index.sqlite` 和缩略／提取缓存。删除后可由档案与必要状态重建。SQLite 不同步到云端，不备份运行中的 WAL 来充当完整备份。

每个实例只写自己的本机状态。共享 metadata 格式版本化，未知字段保留；旧文件首次接入只建立映射，不批量塞入 frontmatter。原子替换必须在同一目录；多文件提交由持久事务日志恢复。`.git`、凭据、临时文件、设备状态不混入云端档案清单，未知普通原文件仍原样保留。

### 2.3 共同类型和接口

由 T03 在 `src/shared/models.ts`、`schemas.ts`、`api.ts` 定义；除 T02 的连接探针类型外，其他任务以此为唯一字段命名来源。

| 类型 | 必须定义的结构 |
| --- | --- |
| `ModuleId` | `learning/research/sports/diet/games/development/inbox`，导航另设 `home/search/plans/settings`，不拿展示名称当身份 |
| `RecordKind` | `raw_input/subject/note/research_project/experiment/activity/meal/game/play_session/dev_project/dev_issue/dev_version/plan/report/advice/document` |
| `RecordEnvelope` | id、schemaVersion、kind、module、role、title、date、createdAt、updatedAt、sourceRefs、attachmentIds、body、按 kind 校验的 data |
| `role` | `actual/plan/reference/template/analysis/suggestion`；统计按 kind 与 role 联合判定，不靠文件存在判断完成 |
| `SourceRef` | archiveId、相对 path、可选 recordId／heading／原文范围、内容哈希；来源时间与业务日期分开 |
| `SaveRecord` | 新增／编辑内容＋`expectedHash`；已有内容变更时先校验 expectedHash，失败返回冲突，不直接覆盖 |
| `PlanData` | sourceId 可空、scheduledDate、time 可空、priority、`pending/done/cancelled`，完成只修改计划状态 |
| `SearchQuery/Hit` | query、module/kind/date 筛选、分页；命中含 recordId/path、片段、定位范围、原文哈希 |
| `CaptureDraft/Preview` | 原文、用户时区、参考时刻、附件；候选记录、原文范围、归属、歧义原因、规则标识 |

结构化字段以 `data` 为唯一可编辑来源，正文承载该记录的正文／备注；录入原话单独保存为 raw_input，再由派生记录关联。不要把同一可编辑字段同时生成到正文和 data 中，使外部编辑后出现两份相矛盾的当前值。

关键服务签名：

```ts
ArchiveRepository.open(root: string): Promise<ArchiveInfo>
ArchiveRepository.save(input: SaveRecord): Promise<RecordEnvelope>
ArchiveRepository.get(id: string): Promise<RecordEnvelope | null>
ArchiveRepository.list(filter: RecordFilter): Promise<RecordEnvelope[]>
ArchiveRepository.remove(id: string, expectedHash: string): Promise<DeletionReceipt>
ArchiveRepository.recover(): Promise<RecoveryReport>
ArchiveRepository.onChange(listener: (e: ArchiveChange) => void): Unsubscribe
SearchService.query(input: SearchQuery): Promise<SearchPage>
SearchService.rebuild(): Promise<IndexReport>
CaptureService.preview(input: CaptureDraft): Promise<CapturePreview>
CaptureService.commit(preview: CapturePreview, edits: CaptureEdits): Promise<CaptureReceipt>
PlanService.schedule(input: ScheduleInput): Promise<RecordEnvelope>
PlanService.setStatus(id: string, status: PlanData['status'], expectedHash: string): Promise<RecordEnvelope>
PlanService.reschedule(id: string, date: string, expectedHash: string): Promise<RecordEnvelope>
```

`ArchiveChange` 含事务 ID、变化 ID／path／hash 和来源。主进程在完整提交后发事件；页面只更新读取视图，不复制业务原件。所有 DTO 用 Zod 校验，文本 Markdown 不执行原始 HTML。IPC 仅暴露命名服务方法，不暴露任意文件路径写入或 shell 执行。

同步类型在 T18 冻结：`EndpointId=webdav|github`；`RemoteEntry` 含 path/hash/revision/size 和可选 recordId，`ScanResult` 含 complete/revision/entries，`RemoteChange` 含 put/delete、path、objectHash、expectedRevision（新文件明确 expected absent）。`ChangeBatch` 含本次 scanRevision 和 changes；`EndpointAdapter.scan():Promise<ScanResult>`、`read(path,revision):Promise<Buffer>`、`apply(batch:ChangeBatch):Promise<EndpointReceipt>`。GitHub scanRevision 为 commit SHA；WebDAV 为本次观察清单指纹，每个文件另有 ETag，不伪装成服务端原子快照。回执逐项记录确认或冲突，不宣称 WebDAV 多文件操作具有原子性。

各功能任务新增服务时，同时修改 `src/main/services.ts`、`src/main/ipc.ts`、`src/preload/index.ts` 与必要的 shared DTO，注册该任务明确列出的接口；这些公共装配文件是所有相关任务的显式修改范围。尚未完成的入口返回明确的未就绪错误，不能临时假报业务成功。

## 3. 执行方式与验证命令

- T01 生成 `scripts/npmw`，定位本项目 `.tooling/node` 的 node/npm，并为子进程配置 PATH。后续命令统一通过该包装器，避免当前 shell 未配置 Node 的问题。
- `./scripts/npmw run dev` 启动开发版；`run build` 使用 electron-vite 输出 `out/main/index.js`；`run typecheck` 执行 TypeScript 检查；`run lint` 检查项目源代码。
- `run test:unit -- <file>` 对应 `vitest run`；`run test:integration -- <file>` 对文件系统与模拟 HTTP 进行独立目录测试，不导入 Electron ABI 的 SQLite 模块。
- `run test:electron -- <file>` 对应 Playwright Electron 项目，构建后从 `out/main/index.js` 启动真实 Electron。原生 SQLite／凭据／窗口测试在此运行，避免普通 Node 测试加载错误 ABI。
- `run test:visual` 检查选定布局及窄窗口；`run package:mac` 构建当前 arm64 Mac 的本地 `.app`。签名／公证不作为付费前提，必须验证本机实际能打开。
- 测试进程必须显式设置独立 `AIA_TEST_MODE=1`、临时档案及状态根目录、模拟日期时钟；生产默认禁用测试桥。测试入口不允许误用已登记真实主库。
- 核心数据、解析、合并任务采用“先写行为测试→观察预期失败→最小实现→定向通过→本机提交”。文档审计、配色等低影响工作不写镜像测试。
- 单项通过后不无理由反复跑全套；改变公共接口或修复失败后跑受影响测试，T24 再执行一次完整验收。

## 4. 逐项执行任务

### T00：工程、原档案和后台只读审计

**Files:** 创建 `docs/audit/environment.md`、`docs/audit/archive-inventory.md`、`docs/audit/existing-sync.md`。只读取 PRD、设计图、真实主库规则与状态；不修改原档案。

**Interfaces:** 产出主库路径／archiveId 候选、文件类型与大小清单、原 GitHub 同步程序／设备身份／未传状态／调度方式、佳明归档位置，供 T05/T15/T23 使用。

- [ ] 检查当前目录及父级 Git 状态、Node／npm／Git 和平台；核对 PRD 与选图存在，将真实结果写入 environment.md。
- [ ] 使用已有连接只读取得档案最新 `AGENTS.md/README.md/14_GitHub同步.md`，核对本地主库及源文件；拿不到时明确缺少哪项访问，不假装完成。
- [ ] 读取原同步代码和运行状态，记录是否存在进程、锁、未传提交及回滚方式；佳明采集和档案同步分别记录。
- [ ] 输出排除项与全量普通文件清单；不完整的扫描标记 incomplete。验收：三个审计文档有来源时点，无原文件或后台变更。

### T01：可重复工具链、Electron 壳与原生依赖探针

**Files:** 创建根目录构建配置、锁文件、`.nvmrc`、`.gitignore`、`scripts/setup-node.sh`、`scripts/npmw`、`src/main/index.ts`、`src/preload/index.ts`、最小 renderer、`tests/electron/smoke.spec.ts`、`tests/helpers/electron-app.ts`。

**Interfaces:** 提供上节所有命令和隔离测试启动器；`launchTestApp({archiveRoot,stateRoot,now}):Promise<TestApp>`。

- [ ] 配置 Node 24.22.1（当前核对可用版本）及 npm：优先复用可用工具链；缺 npm 时从 Node 官方发行包按校验清单安装到忽略目录 `.tooling/node`，不覆盖系统环境。
- [ ] 创建 electron-vite React＋TypeScript 最小工程，保留现有 PRD／design 文件；锁定兼容依赖、明确 main/preload/renderer 入口。Git 尚未初始化时仅初始化本机工程版本库，不创建远端。
- [ ] 定义测试脚本，先写 smoke：窗口能启动、只使用测试目录、renderer 无 Node 权限、SQLite 能在 Electron 内建库并重开读取；观察原生模块缺失或功能未接通导致的预期失败。
- [ ] 配置 `contextIsolation:true/nodeIntegration:false` 和最小 bridge，按实际 ABI 构建 SQLite；执行 `./scripts/npmw run build`、`run test:electron -- tests/electron/smoke.spec.ts`，窗口及原生模块均通过。
- [ ] 提交锁文件与配置；`.tooling/node/node_modules/out/dist`、用户数据和凭据不入库。记录启动命令和依赖版本。

### T02：提前验证云端协议能力

**Files:** 创建 `src/shared/connections.ts`、`src/main/connections/probe-service.ts`、`tests/helpers/fake-cloud.ts`、`tests/integration/protocol-probe.test.ts`、`docs/audit/protocol-capabilities.md`。

**Interfaces:** `probeEndpoint(config, ephemeralSecret, testScope):Promise<CapabilityReport>`，报告完整列举、中文路径、条件写入／删除、创建防覆盖、错误和限制；不把凭据写报告。

- [ ] 写模拟测试：旧 ETag PUT／DELETE 失败、`If-None-Match:*` 不覆盖、分页缺失得到 complete=false、401 不循环认证；运行 `run test:integration -- tests/integration/protocol-probe.test.ts` 观察失败。
- [ ] 实现探针及模拟服务器；探针只能操作明确指定且可核对的测试目录／测试分支，临时凭据由安全输入提供，不放命令行／日志。
- [ ] 在提供真实测试连接后验证：坚果云条件写入、强 ETag、实际分页方法、中文路径和逐项读回；超过单次上限主要用模拟契约覆盖，真实大目录验证使用已授权现有样本或有请求预算的独立测试数据，不能无预算创建数百文件。GitHub 核对私有库权限、读取 head 与快进竞争。没有测试连接时标记 live pending，模拟开发继续。
- [ ] 记录实际行为及支持矩阵。条件写入或列举不可靠时，不允许用“先读再写”替代并发保护；先解决该适配器能力缺口，M3/M4 不宣称通过。
- [ ] 定向测试通过后提交。此任务不检查或改动主库正文，不新增 Garmin 请求。

### T03：记录模型、编码与类型化 IPC 契约

**Files:** 创建 `src/shared/models.ts/schemas.ts/api.ts`、`src/main/archive/codec.ts`、`tests/unit/record-model.test.ts`。

**Interfaces:** 第 2.3 节类型；`parseDocument(bytes,path):ParseResult`、`serializeRecord(record):Buffer`，ParseResult 区分业务记录、原始文档、坏元数据。

- [ ] 写测试：不同领域合法数据往返不丢未知字段；role 不同；重复 ID／坏 YAML 有明确问题；零、空值、缺失数量不混淆。
- [ ] 运行 `run test:unit -- tests/unit/record-model.test.ts`，确认行为尚未实现。
- [ ] 实现联合类型、校验、稳定 ID 和 codec；实验数据、游戏进度、开发版本不复用成同一种任务结构。
- [ ] 定向通过并 typecheck；确认不把模板／参考文档解析为本人实际完成记录。
- [ ] 提交 `feat: define archive record contracts`。

### T04：可靠本机写入、附件、草稿与崩溃恢复

**Files:** 创建 `src/main/archive/paths.ts/repository.ts/transactions.ts/attachments.ts`、`src/main/ipc.ts`、`tests/integration/archive-recovery.test.ts`、`tests/electron/persistence.spec.ts`。

**Interfaces:** `ArchiveRepository` 全部方法；`AttachmentStore.add(file):Promise<AttachmentRef>`；`DraftStore.save/load` 存本机草稿，不等于已归档。

- [ ] 写测试：expectedHash 失效拒绝覆盖；附件相对路径与逻辑 ID；路径穿越／软链接逃逸拒绝；在暂存、替换、回执各阶段杀进程后可恢复；磁盘失败输入仍可读。
- [ ] 运行 `run test:integration -- tests/integration/archive-recovery.test.ts` 观察失败。
- [ ] 实现同目录暂存校验／原子替换、持久事务日志、提交后事件、删除标记和恢复；多文件操作启动后完成或回退，有外部变化则保留冲突；保存成功只在持久写入确认后发出。
- [ ] Electron 测试创建记录／附件／草稿，刷新、关闭窗口再打开、显式退出并重启后核对。执行上述 integration 和 `run test:electron -- tests/electron/persistence.spec.ts`。
- [ ] 提交 `feat: persist archive records with recovery`。

### T05：原档案导入、稳定身份与外部文件变化

**Files:** 创建 `src/main/archive/importer.ts/watcher.ts/identity-map.ts`、`tests/fixtures/legacy/`、`tests/integration/legacy-import.test.ts`。

**Interfaces:** `importArchive(root,{mode:'read-only'|'attach'}):Promise<ImportReport>`；`watchArchive(root,onChange):Unsubscribe`。attach 只建立授权的新元数据，不改旧正文。

- [ ] 写测试：原 Markdown／JSON／未知附件字节不变；README／模板／论文不记为实际学习；外部正文修改可接收；含 ID 的改名仍为同记录；ID 重复／被删、无 ID 文件同时改名改文时保留并标需核对。
- [ ] 运行 `run test:integration -- tests/integration/legacy-import.test.ts` 观察失败。
- [ ] 按 T00 审计配置路径映射，旧文件建立稳定身份和来源；启动全量核对＋文件监听防漏，内容哈希防自触发循环；模糊改名不擅自认定身份。
- [ ] 定向通过；研究概况沿用既有权威来源的引用，不生成第二份独立可改的概况副本。
- [ ] 提交 `feat: attach legacy archive without rewriting originals`。

### T06：中文关键词索引、搜索与定位服务

**Files:** 创建 `src/main/indexing/database.ts/search.ts/projection.ts`、`tests/electron/search.spec.ts`、`tests/unit/search-query.test.ts`。

**Interfaces:** `SearchService.query/rebuild`；`resolveSource(hit):Promise<SourceLocation>`，来源变更时重新核对 hash／定位，不指向过期偏移。

- [ ] 写测试：标题／正文／实验参数／报告命中，两字“早餐”、单字“蛋”、ODE、PDE、`%`、`_`、引号均按文字查找；过滤和分页正确；编辑后旧词不再命中；索引删除后可重建。
- [ ] 运行 query unit 及 Electron search 测试观察失败；SQLite 原生加载只在 Electron 测试使用。
- [ ] 建立可重建投影，参数化子串匹配，转义查询通配符；返回片段、类型、模块、日期和来源范围；未知附件索引名称与已有说明，不宣称扫描件全文可查。
- [ ] 保存／外部变更事件触发增量投影，启动补扫描，执行 `run test:electron -- tests/electron/search.spec.ts` 通过；暂以 1 万条明确测试记录测查询基线，超过 500ms 时记录并优化候选检索，不能牺牲一字／两字正确性。
- [ ] 提交 `feat: index archive content and resolve search hits`。

### T07：暖白松绿页面骨架、首页与独立搜索页

**Files:** 创建 `src/renderer/App.tsx`、`components/AppShell.tsx/RecordDetail.tsx/SourceLink.tsx/SaveState.tsx`、`styles/tokens.css/layout.css`、`features/home/HomePage.tsx`、`features/search/SearchPage.tsx`、`tests/electron/navigation-search.spec.ts`。

**Interfaces:** 通过 `window.aia` 调用已定义服务；路由 `/ /search /plans /learning /research /sports /diet /games /development /settings`；详情使用 recordId，搜索 query 存于路由状态。

- [ ] 写行为测试：十个同级导航顺序；顶部与独立搜索页共享查询；点击命中直达详情和原文件；空档案无示例事实或假同步成功。
- [ ] 运行 `run test:electron -- tests/electron/navigation-search.spec.ts` 观察失败。
- [ ] 实现骨架和读取视图，按选图中央随手记、最近归档、右侧摘要、底部三端状态分布；原文件入口仅打开经解析的有效位置，失效来源给文字说明。
- [ ] 行为测试通过；在 1487×1058 与 1100×800 截图检查操作不被裁掉。视觉核对颜色、层级、间距，不对每个 CSS 值编写镜像测试。
- [ ] 提交 `feat: build selected workbench layout and search page`。

### T08：自然语言随手记的真实归档闭环

**Files:** 创建 `src/main/capture/parser.ts/service.ts`、`src/renderer/features/home/CaptureComposer.tsx`、`tests/unit/capture-parser.test.ts`、`tests/electron/capture.spec.ts`。

**Interfaces:** `CaptureService.preview/commit`；commit 通过 T04 一次事务保存 raw_input 与派生记录，返回 sourceId／recordIds／本机状态；云端未接通时显示待连接，不模拟上传成功。

- [ ] 写测试：今天早餐鸡蛋→当天饮食事实且数量空；明天准备→未来计划；“今天没吃早餐”不能变成吃过；“昨天跑了30分钟”保留明确时长；“学了ODE一节”只归已知科目／待整理，不建立完整科目表；混合／矛盾句保留原文与范围。
- [ ] 运行 `run test:unit -- tests/unit/capture-parser.test.ts` 观察失败。
- [ ] 实现日期、餐次、明确数量／时长、领域和计划／否定规则；预览可改、复杂项待整理。规则有命中依据，不在首版引入付费推理依赖。
- [ ] Electron 测试归档、修改归属、撤销和重启后读取；模块、首页、搜索显示同 ID；执行 unit 和 `run test:electron -- tests/electron/capture.spec.ts` 通过。
- [ ] 提交 `feat: archive everyday language with editable preview`。

### T09：今日计划与跨模块关联

**Files:** 创建 `src/main/plans/service.ts`、`src/renderer/features/plans/PlansPage.tsx`、`components/PlanSourceLink.tsx`、`tests/unit/plan-service.test.ts`、`tests/electron/plans.spec.ts`。

**Interfaces:** `PlanService.schedule/setStatus/reschedule`；`listDay(date):Promise<RecordEnvelope[]>`。领域页面调用同一个 schedule，sourceId 不存页面名称或绝对文件路径。

- [ ] 写测试：来源加入今天、同一计划在首页与详情状态一致、完成／撤销／延期、独立待办无来源；完成不修改 subject 的掌握度或 experiment 的成功状态，来源被删除仍保留计划和失效说明。
- [ ] 运行 `run test:unit -- tests/unit/plan-service.test.ts` 观察失败。
- [ ] 实现服务与日期／时间／优先级编辑；首页查询同一份计划，不另保存“首页任务副本”。计划删除通过 T04 保留撤销／删除身份。
- [ ] unit 与 `run test:electron -- tests/electron/plans.spec.ts` 通过；至少核对新增、完成、延期后重启状态。
- [ ] 提交 `feat: link daily plans to source records`。

### T10：学习科目、笔记与疑问

**Files:** 创建 `src/main/modules/learning.ts`、`src/renderer/features/learning/LearningPage.tsx/SubjectDetail.tsx`、`tests/electron/learning.spec.ts`。

**Interfaces:** `LearningService.listSubjects/getSubject/saveSubject/saveNote` 均使用 RecordEnvelope；下一步通过 T09 schedule 建立关联。

- [ ] 写 Electron 行为测试：自定义科目→笔记→章节／疑问／材料→加入今日计划→按正文找到；未知科目先待整理，不默认生成 ODE/PDE 目录。
- [ ] 运行 `run test:electron -- tests/electron/learning.spec.ts` 观察失败。
- [ ] 实现科目列表、详情、笔记与学习实际记录；保留 Obsidian 来源字段但不开发完整插件，不把科研前置资料归为科目笔记。
- [ ] 测试通过；没有实际时长不显示推算时长，资料存在和勾选待办不改变已学进度。
- [ ] 提交 `feat: organize learning by subjects and notes`。

### T11：科研进展、编号实验与结果

**Files:** 创建 `src/main/modules/research.ts`、`src/renderer/features/research/ResearchPage.tsx/ProjectDetail.tsx/ExperimentDetail.tsx`、`tests/electron/research.spec.ts`。

**Interfaces:** `ResearchService.listProjects/getProject/saveExperiment`；实验数据为目的、方法／参数、实际状态、结果、结论、下一步、资料／数据／代码版本引用；概况沿用原权威 sourceRef。

- [ ] 写测试：测试课题下新增编号实验、添加参数与结果附件、改实验标题后仍按编号定位、下一步入计划；模板／他人论文不增加本人实验数量。
- [ ] 运行 `run test:electron -- tests/electron/research.spec.ts` 观察失败。
- [ ] 实现课题进展视图、前置资料入口、实验索引与领域表单；结果和结论可分别为空，不能自动填“成功”。
- [ ] 测试通过；编号／关键词搜索回到具体实验，原附件链接正确；实际进度变化只来自明确记录。
- [ ] 提交 `feat: track research progress and experiment records`。

### T12：饮食计划与实际饮食

**Files:** 创建 `src/main/modules/diet.ts`、`src/renderer/features/diet/DietPage.tsx`、`tests/electron/diet.spec.ts`。

**Interfaces:** `DietService.listDay/saveMeal`；meal 数据含餐次、描述、明确数量或空值，role 区分 plan/actual；计划引用 T09。

- [ ] 写测试：早餐事实与明天早餐计划分开；接收 T08 同 ID 记录；可改餐次／描述，无数量不出现自动补值或营养推算。
- [ ] 运行 `run test:electron -- tests/electron/diet.spec.ts` 观察失败。
- [ ] 实现按日／餐次查看与编辑、计划关联、来源原话入口；不加入照片识别。
- [ ] 测试通过，重启后内容及分类不变。
- [ ] 提交 `feat: distinguish meal plans and actual meals`。

### T13：游戏库与游玩进度

**Files:** 创建 `src/main/modules/games.ts`、`src/renderer/features/games/GamesPage.tsx/GameDetail.tsx`、`tests/electron/games.spec.ts`。

**Interfaces:** `GamesService.saveGame/saveSession/listSessions`；game 与 play_session 独立，有 gameId 关联；时长可空。

- [ ] 写测试：创建游戏、更新进度／心得、添加游玩记录并查看历史，未填时长不推算；可把游玩安排加入今天。
- [ ] 运行 `run test:electron -- tests/electron/games.spec.ts` 观察失败。
- [ ] 实现游戏库与详情历史，不自动接入游戏平台账户或后台计时器。
- [ ] 测试通过，修改后首页最近归档和关键词结果一致。
- [ ] 提交 `feat: maintain game library and play history`。

### T14：开发项目、问题和版本

**Files:** 创建 `src/main/modules/development.ts`、`src/renderer/features/development/DevelopmentPage.tsx/DevProjectDetail.tsx`、`tests/electron/development.spec.ts`。

**Interfaces:** `DevelopmentService.saveProject/saveIssue/saveVersion`；issue/version 关联 projectId，repoUrl 是显式关联，不是唯一身份。

- [ ] 写测试：项目名和仓库名不同，修改项目名后关联不丢；阶段目标、问题状态、版本记录能编辑和定位；下一步加入今天。
- [ ] 运行 `run test:electron -- tests/electron/development.spec.ts` 观察失败。
- [ ] 实现独立项目详情和版本列表，校验仓库链接并提供打开入口，不自动改仓库代码、Issues 或发布版本。
- [ ] 测试通过；档案同步目标与开发项目仓库字段不混用。
- [ ] 提交 `feat: track development projects and versions`。

### T15：佳明已有归档读取与运动页面

**Files:** 创建 `src/main/garmin/reader.ts/normalizer.ts`、`src/renderer/features/sports/SportsPage.tsx/ActivityDetail.tsx`、`tests/fixtures/garmin/`、`tests/unit/garmin-normalizer.test.ts`、`tests/electron/sports.spec.ts`。

**Interfaces:** `GarminArchiveReader.readOverview(date):Promise<GarminOverview>`、`readActivities(range)`、`readTrainingPlan(date)`；返回业务日期、实际采集时间、质量／缺项、来源路径；不暴露 Garmin 写接口。

- [ ] 从 T00 已核对的格式制作去个人化 fixture，写测试覆盖成功、旧值、部分成功、失败、没有新增活动与未知单位；失败不能变成零或“今日已同步”。
- [ ] 运行 `run test:unit -- tests/unit/garmin-normalizer.test.ts` 观察失败。
- [ ] 实现已有 JSON／Markdown 状态解析、活动历史、原训练建议和已有分析入口；原文件仍归原链路维护，APP 不回写原始快照。
- [ ] 运行 unit 与 `run test:electron -- tests/electron/sports.spec.ts` 通过；首页显示来源日期与最近成功时间，无截图导入入口。
- [ ] 提交 `feat: display archived Garmin data with quality status`。

### T16：周报、关注项和训练安排分析

**Files:** 创建 `src/main/reports/weekly.ts/training.ts/overview.ts`、`src/renderer/features/home/OverviewRail.tsx`、`src/renderer/features/sports/TrainingAdvice.tsx`、`src/renderer/features/reports/ReportDetail.tsx`、`tests/unit/report-rules.test.ts`、`tests/electron/reports.spec.ts`。

**Interfaces:** `WeeklyReportService.build(week):Promise<RecordEnvelope>`、`TrainingAdviceService.propose(date):Promise<AdvicePreview[]>`、`OverviewService.read(date):Promise<HomeOverview>`。

- [ ] 写规则测试：周一至周日按 Asia/Shanghai；只统计实际记录和明确运动时长；重复导入不重复计数；模板／计划／参考论文不算成果；缺数据说明覆盖日期；报告引用能回到源档案。
- [ ] 运行 `run test:unit -- tests/unit/report-rules.test.ts` 观察失败。
- [ ] 实现确定性基础分析：计划与实际完成对照、已知运动时长统计、逾期／缺项／冲突关注；读取现有分析并标来源。训练建议首版基于已有课程和实际执行，提供“采用原计划／顺延未完成课程／跳过并记录原因／调整到用户指定时段”的可解释方案；缺恢复数据不编造生理阈值或增量强度结论。
- [ ] 用户采用后才生成或调整 T09 计划，原 Garmin 建议保留。运行 unit 与 `run test:electron -- tests/electron/reports.spec.ts`；确认这是真实规则分析，不宣称已有通用 AI 自由推理。
- [ ] 提交 `feat: generate source-backed weekly and training summaries`。

### T17：连接设置、凭据和真实状态模型

**Files:** 创建 `src/main/connections/credential-vault.ts/settings.ts`、`src/renderer/features/settings/ConnectionsPanel.tsx`、`tests/electron/connections.spec.ts`。

**Interfaces:** `CredentialVault.set/get/remove(endpoint)` 仅主进程调用；`ConnectionService.configure/test/getState` 返回脱敏信息，UI 不能 get 明文密码；test 复用 T02 探针。

- [ ] 写 Electron 测试：两端分别配置／禁用，renderer 取不到令牌；关闭重开连接配置仍在；凭据失败无假成功；导出普通设置不含密文／明文凭据。
- [ ] 运行 `run test:electron -- tests/electron/connections.spec.ts` 观察失败。
- [ ] 使用锁定 Electron 版本支持的 safeStorage 异步能力保存密文；加密不可用时保留本机功能并提示重试连接，不降级明文持久保存。GitHub 使用限定仓库的授权；坚果云使用第三方应用密码，不假设 APP 自动继承聊天插件登录。
- [ ] 测试通过；区分待连接、已配置、验证成功与已经同步；凭据变更清除认证错误状态并保留未传数据。
- [ ] 提交 `feat: configure archive endpoints without exposing credentials`。

### T18：统一变化模型、版本祖先和合并计划

**Files:** 创建 `src/shared/sync.ts`、`src/main/sync/graph.ts/planner.ts/journal.ts`、`tests/helpers/memory-endpoint.ts`、`tests/unit/sync-planner.test.ts`、`tests/integration/sync-journal.test.ts`。

**Interfaces:** `planSync(input:SyncInput):SyncPlan` 是无网络纯函数；输入含本机快照、各端完整快照、各端独立 base 和已知版本图；输出本机变更、各端条件变更、冲突集合。`SyncJournal.prepare/recordReceipt/recover` 持久化阶段与对象，不依赖可删 SQLite。

- [ ] 先写测试：同内容不写；单方编辑传播；三端同时改不同文件全保留；同文件不同非重叠文本可合并；三端重叠修改保留全部候选；删改冲突；不完整扫描不产生删除；初次接入不凭空假设 base；回执丢失／各阶段重启可恢复。
- [ ] 运行 `run test:unit -- tests/unit/sync-planner.test.ts` 与 `run test:integration -- tests/integration/sync-journal.test.ts` 观察失败。
- [ ] 按下述规则实现版本图、墓碑和计划；必要 base／冲突对象先持久化，回执成功后只推进对应端 base。保留原文与来源，不自动选“坚果云为主所以覆盖 GitHub”。
- [ ] 两组定向测试通过，输出可读变更与冲突原因；无共同祖先的不同内容保留待处理，不猜归属。
- [ ] 提交 `feat: plan multi-endpoint merges with durable history`。

**必须编码进测试的合并规则：**

1. 每个端分别保存最后确认内容及版本；外部变化以该端 base 为已知祖先，形成候选节点。本机写入形成明确的新节点；相同内容哈希共用对象。
2. 三个候选使用共同祖先判断是否已包含某项修改，不把“先拉 A 再用更新后的本机拉 B”误当成 B 从未修改。相同候选折叠；祖先／后代保留后代；不同文件独立处理。
3. Markdown 文本的非重叠行变化可做三方合并；结构化数据按明确字段合并，数组和附件二进制并发修改保守保留候选。任何不确定的多人／多端同字段改动都进入冲突。
4. 首次接入未知的现有远端，只能比较并建立 baseline；不同内容不能自动覆盖。明确的新空测试端允许初始化；根目录丢失、401 或截断列表不能等同“所有文件被删除”。
5. 删除是有身份和历史的版本；墓碑与必要旧对象保留。已删 ID 被旧副本重新带回时先提示恢复／冲突，显式恢复形成新版本，不无声复活。
6. 应用本机变更仍检查实际 hash；检测外部变化则重算。文件系统的 expectedHash 检查不是任意外部编辑器都会遵守的锁；接管审计必须记录所有写入者，保留观察到的版本，不能宣称获得跨所有编辑器的原子 CAS。

### T19：坚果云 WebDAV 完整适配器

**Files:** 创建 `src/main/sync/adapters/webdav.ts`、`src/main/sync/request-budget.ts`、`tests/integration/webdav-adapter.test.ts`、`tests/electron/webdav-connection.spec.ts`。

**Interfaces:** 实现 T18 的 `EndpointAdapter`；构造时注入 `CredentialVault`、Transport、Clock、RequestBudget 和 T02 CapabilityReport；凭据只在请求层使用。

- [ ] 写模拟测试：PROPFIND Depth:1 递归与已验证分页、750 条上限后的完整性、中文／空格／`#`路径、空文件、弱／缺失 ETag；条件 PUT／DELETE、create-only、防覆盖竞争、超时后读回、401/429/507。
- [ ] 运行 `run test:integration -- tests/integration/webdav-adapter.test.ts` 观察失败。
- [ ] 采用 T02 实测支持的 ETag／条件操作，不凭标准假定坚果云实现。扫描完成才置 complete；每次写入有 expectedRevision，412 进入重算；无可靠条件保护或分页时明确阻断对应写入／全库验收，不自动降级覆盖。
- [ ] 大文件流式上传／下载并逐项核对内容；每端并发默认 1。默认预算最多 300 次／30 分钟，为账号其他工具留量；遵守响应 Retry-After，额度不足保留待传。模拟通过后在独立真实测试目录运行同契约检查，报告实际支持情况。
- [ ] 提交 `feat: synchronize files through verified WebDAV semantics`。

坚果云的[官方授权及限制说明](https://help.jianguoyun.com/?p=2064)要求应用密码，并列出免费账户请求频率与单次列举限制；执行时重新核对账号实际规则。这里的 300 次／30 分钟是本计划的保守客户端预算，不是引用为服务商承诺。WebDAV 条件操作按 [RFC 4918](https://www.rfc-editor.org/rfc/rfc4918.html)实现，服务支持程度仍以 T02 实测为准。

### T20：GitHub 完整适配器与竞争保护

**Files:** 创建 `src/main/sync/adapters/github.ts`、`tests/integration/github-adapter.test.ts`、`tests/electron/github-connection.spec.ts`。

**Interfaces:** 实现同一 `EndpointAdapter`；端配置为明确 owner/repo/branch，读取版本为 commit SHA，receipt 含 commit SHA 和逐项验证结果。

- [ ] 写模拟测试：私有权限错误、递归 tree truncated 后继续完整遍历、blob／空文件读取、多文件同一提交、删除树节点、头部在发布前前进、上传成功后响应丢失、无变化不创建 commit。
- [ ] 运行 `run test:integration -- tests/integration/github-adapter.test.ts` 观察失败。
- [ ] 读取 ref→commit→真实 tree SHA；以读取的 head 为 parent 创建 blob/tree/commit，再 `PATCH git/refs` 且 `force:false`。标准 REST 不伪造 connector 才有的 `expected_sha` 参数；非快进拒绝后重新获取并重算，不能强推。
- [ ] 不完整 tree 不触发删除；二进制与附件按实际内容核对；遇到超出接口能力、LFS 指针未取到原件或权限不足，列出失败项，不能略过后报整库成功。测试通过并在指定测试分支核对原始内容及提交回读。
- [ ] 提交 `feat: synchronize GitHub archive with fast-forward protection`。

[GitHub 官方 ref 文档](https://docs.github.com/en/rest/git/refs#update-a-reference)中的 `force:false` 提供快进保护，不是可独立替代整个合并协议的通用 CAS。回读应同时区分“本次提交确实存在”和“最近一次核对时当前远端已一致”。

### T21：协调器、调度、首页状态与冲突交互

**Files:** 创建 `src/main/sync/coordinator.ts/scheduler.ts`、`src/main/tray.ts`、`src/renderer/features/settings/SyncDetails.tsx/ConflictDetail.tsx`、`src/renderer/features/home/SyncControls.tsx`、`tests/integration/sync-coordinator.test.ts`、`tests/electron/sync-flow.spec.ts`。

**Interfaces:** `SyncCoordinator.run(reason:'startup'|'manual'|'timer'|'local-change'):Promise<SyncRunReport>`、`getState():SyncState`、`resolveConflict(input):Promise<ResolutionReceipt>`。状态分别含本机保存、各端 lastAttemptAt/lastSuccessAt/lastComparedAt、pending/conflicts/error，含比较时点。

- [ ] 写测试：单／双端启用；两端同时有变化先统一计算；同端重复十轮无写入／提交；一端离线重启补齐；上传超时但远端已接受时读回后幂等确认；401 停止自动认证重试直到更新凭据；429 尊重 Retry-After；重试不刷新成功时间；关窗后继续同步、显式退出后停止且下次续传。
- [ ] 运行 `run test:integration -- tests/integration/sync-coordinator.test.ts` 观察失败。
- [ ] 实现 archive 级单实例锁、持久队列和预算；默认启动一次、运行中每 5 分钟检查、本机停止连续编辑 10 秒后准备、手动请求合并去重。临时错误退避 30 秒→1分→2分→5分→最长15分并加抖动，持续保留队列；手动也不能绕过服务端限流。关窗隐藏到菜单栏继续运行，菜单提供打开／状态／显式退出；退出停调度并保存检查点，下次恢复。不新增重复登录任务或默认开启系统弹窗。
- [ ] 实现“归档并同步”和“立即同步”的不同入口、上次时间、各端状态、变更列表及多版本冲突比较。非冲突自动处理；局部失败显示部分成功；冲突解决仍检查来源版本是否过期。运行 integration 和 `run test:electron -- tests/electron/sync-flow.spec.ts` 通过。
- [ ] 提交 `feat: coordinate bidirectional archive sync and expose truthful status`。

**状态机要求：** 未连接、已配置、扫描中、规划中、应用本机、发布、核对、已同步／待重试／需重新认证／受限／冲突分别可辨。WebDAV 批次未全部核对不能标整端成功；无变化轮次可更新最近比较时间，不伪造上传记录。尚未解决的冲突不阻止其他不相关记录保存。

### T22：完整备份、独立恢复与旧版发布冻结

**Files:** 创建 `src/main/backup/manifest.ts/exporter.ts/restorer.ts`、`src/renderer/features/settings/BackupPanel.tsx`、`tests/integration/backup-restore.test.ts`、`tests/electron/backup.spec.ts`。

**Interfaces:** `BackupService.export(destination):Promise<BackupReceipt>`、`inspect(file):Promise<RestorePreview>`、`restore(file,target):Promise<RestoreReceipt>`；manifest 含相对路径／大小／SHA256／schemaVersion／记录和附件清单／必要状态说明。

- [ ] 写测试：包含未知文件、原文、实验附件、计划关联、冲突正文、必要 base／墓碑；排除凭据和可重建索引；损坏／缺文件／路径穿越包拒绝；导出中发生编辑仍获得一致快照；恢复到新目录后可搜索，旧版恢复不自动发布。
- [ ] 运行 `run test:integration -- tests/integration/backup-restore.test.ts` 观察失败。
- [ ] 导出时冻结写入并排空本机事务／同步回执或取得一致检查点，再流式打包；包含无法从缓存重建的状态，但不把它们当跨设备可直接续跑的队列。恢复先验证并写独立 staging 目录，再核对／切换；不直接覆盖正在运行的数据目录。
- [ ] 恢复设置 `publishSuspendedForRestore`，停旧队列重放；重新扫描两端并展示差异，用户选择继续合并后才发布。坏备份／中途失败保持当前档案完整。integration 和 `run test:electron -- tests/electron/backup.spec.ts` 通过。
- [ ] 提交 `feat: back up and restore complete archives safely`。

### T23：真实主库接入、整库迁移与原后台交接

**Files:** 创建 `src/main/sync/migration.ts`、`src/renderer/features/settings/ArchiveSetup.tsx`、`tests/integration/migration.test.ts`、`docs/acceptance/real-data-onboarding.md`、`docs/acceptance/background-handoff.md`。

**Interfaces:** `MigrationService.preview(source,target):Promise<MigrationManifest>`、`run(manifest):Promise<MigrationReceipt>`；manifest 绑定扫描时点与每项源／目标 hash，改变后重算，不执行陈旧覆盖。

- [ ] 写测试：已存在的同名文件冲突、未知文件／附件保全、迁移中限额和中断恢复、任一源变化使旧 manifest 失效；执行 `run test:integration -- tests/integration/migration.test.ts` 观察失败并实现到通过。
- [ ] 在真实主库先只读接入并运行全量核对，完成 T22 独立可恢复备份；核对各启用端身份、应用密码／授权和目标目录。缺少凭据或用户本人验证时只等待该步骤，不阻塞已授权的其他测试。
- [ ] 按 T00 记录完成接管：保留原未传内容／设备身份和回滚资料→暂停并确认旧 GitHub 同步无在途写入→最终扫描→单协调器接管。只处理要接管的文件同步，不暂停佳明任务或改其调度；未成功交接不得并开两个写入器。
- [ ] 依据 manifest 迁移整套工作文件、附件及未知普通文件，分批校验，失败继续可重试。已有 Git 历史留在原本机仓库及 GitHub，首版明确不宣称已把完整 Git 历史备份到坚果云。
- [ ] 做真实闭环：APP 新建测试记录→两端回读；指定端外部修改→APP／另一端可见；经有权限工具实际落档的测试内容→APP 搜到；测试结束核对清理结果和两端状态。报告明确“模拟通过／真实通过／待验证”，接管失败时先停新协调器再恢复旧工具并核对，不能同时恢复两个写入器。提交脱敏文档与功能，不提交真实档案和令牌。

**上线入口的最少输入：** 实际本地主库目录、坚果云指定目录和应用密码、GitHub 指定库／分支及授权。科目结构、模型与新付费服务不是此步硬性前提。

### T24：整版验收、视觉复核与可运行 Mac 包

**Files:** 创建 `docs/acceptance/A01-A24.md`、`docs/acceptance/visual-review.md`、`docs/acceptance/release-checklist.md`、`README.md`；完善 `electron-builder.yml`，创建 `tests/electron/packaged-app.spec.ts`。

**Interfaces:** `package:mac` 输出本机 arm64 `.app`；README 说明启动、档案位置、窗口退出行为、备份恢复和连接设置；验收记录每项关联任务、测试／实际操作、结果与证据。

- [ ] 先写打包启动测试：从构建产物打开，在指定测试目录保存、退出、再启动读取，SQLite、附件相对路径和凭据不可用降级说明都正确；观察尚未正确配置打包导致的失败。
- [ ] 执行 typecheck、lint、unit、integration、Electron 全套；只在有真实配置的范围运行 live 契约检查。任何失败先定位修复，再重复受影响项；不把 live pending 计为通过。
- [ ] 在 1487×1058 对照参考图和实际截图核对布局／配色／中文可读性；在 1100×800 核对同步和归档仍可达。实测记录／空状态分别核对，保留对照图；不要求生成图和系统字体逐像素相同。
- [ ] 执行 `./scripts/npmw run package:mac`，保留原生模块 unpack，稳定应用标识；本机实际打开 `.app` 并运行 packaged-app 测试。若系统要求本人授权或 Keychain 重连，说明实际步骤，不更改系统安全设置或要求购买证书才能验收个人版。
- [ ] 对下节 A01–A24 逐行填写证据和结果，完成数据目录备份恢复演练、迁移清单、原后台交接状态和依赖／工具链记录后提交 `release: verify personal workbench v1`。只有全体首版必做项实际通过才称首版完成；打包成功、漂亮界面或仅模拟通过不能替代真实同步验收。

## 5. PRD 验收覆盖矩阵

| PRD 验收 | 责任任务 | 主要证据 |
| --- | --- | --- |
| A01 导航与视觉 | T07、T24 | navigation-search；参考图／实际图对照 |
| A02 本机持久化 | T04、T24 | persistence；打包应用退出重开 |
| A03 随手记事实 | T08、T12 | capture-parser、capture、diet |
| A04 计划与事实 | T08、T09、T12 | 日期／角色断言与跨页状态 |
| A05 不确定内容 | T08 | 原文／歧义／待整理及纠正测试 |
| A06 保存与网络失败 | T04、T21 | 文件故障注入、同步单端失败 |
| A07 搜索与定位 | T06、T07、T11、T16 | 正文／参数／报告关键词与来源定位 |
| A08 搜索更新 | T05、T06、T21 | 外部编辑／同步事件后索引更新 |
| A09 计划关联 | T09–T16 | 关联计划状态与领域事实隔离 |
| A10 GitHub 接回 | T20、T21、T23 | 模拟竞争及真实测试分支／档案回读 |
| A11 WebDAV 接回 | T19、T21、T23 | 模拟契约及真实测试目录回读 |
| A12 两端上传与状态 | T19–T21、T23 | 各端文件哈希／回执／独立成功时间 |
| A13 部分失败与补传 | T18、T21 | 杀进程／断网后队列与回执恢复 |
| A14 冲突与删除 | T18–T21 | 三端并发、删改冲突与墓碑案例 |
| A15 变更比较 | T18、T21 | 新增／修改／删除／比较时点及无变化轮次 |
| A16 整库迁移 | T02、T19、T23 | 完整列举探针、迁移清单与失败项 |
| A17 备份与恢复 | T04、T22 | 完整包、独立目录恢复及附件哈希 |
| A18 旧备份恢复后同步 | T18、T21、T22 | 发布冻结、重新比较与用户选择 |
| A19 佳明真实性 | T15、T16 | 旧值／缺项 fixture 与日期／来源展示 |
| A20 科目与科研 | T10、T11 | 自定义科目、实验编号、参数与附件 |
| A21 场景基础功能 | T12–T14 | 饮食事实、游戏历史、不同名仓库关联 |
| A22 摘要与周报 | T05、T16 | 模板排除、统计依据与来源链接 |
| A23 聊天落档边界 | T05、T21、T23 | 实际落档可接回，纯聊天未被虚报归档 |
| A24 连接和额度异常 | T02、T17、T19–T21 | 401／429／507、预算、成功时间不误刷新 |

## 6. 完成定义、风险处置与执行交接

### 6.1 哪些情况必须保留为未通过

- 未取得真实应用密码／授权：可以完成本机和模拟验证，不得声称真实双向同步、额度行为和整库迁移已验收。
- WebDAV 不能可靠条件写入或完整列举：修正适配方案并补探针，不能偷偷改成覆盖式上传或单向备份来宣称满足 PRD。
- 旧后台仍有未处理写入：停在只读核对或测试数据阶段；其他模块继续推进，不进行主库双写。
- 大文件或接口权限不支持：报告具体路径与原因，保留本机原件，不能从迁移范围中静默删除。
- 复杂随手记：保留原文待整理是正常兜底；清楚的早餐／运动／学习／计划句仍必须实际分类和归档，不能全部以待整理应付验收。

### 6.2 并行开发与提交边界

- 推荐按任务逐项实现和复核；共享模型／存储／同步合并主线串行。
- T10–T14 可在 T03/T04/T09 接口稳定后分开开发，各自只改模块目录；T19 与 T20 在 T18 契约冻结后可并行。
- 修改 shared 类型须主协调者统一处理并运行所有消费任务的定向测试。任何模块不得直接绕过 Repository 写文件或自行发起第二套同步。
- 每项完成后更新任务复选框与实际证据，提交明确文件；没有 Git 时按 T01 先建立本机版本记录，不默认推送到数据档案仓库。
- 当前只交付计划。用户后续要求开始执行时，从 T00 启动；不要在新对话重复询问已确认配色、导航或是否需要自然语言归档。

### 6.3 技术依据与执行时复核

以下链接为规划时阅读的主要维护方／标准资料，日期 2026-10-25；执行时核对当前版本并锁定依赖。

- [Node 版本与 LTS](https://nodejs.org/en/about/previous-releases)：开发采用受支持的 LTS，版本和平台在 T01 记录。
- [electron-vite 入门](https://electron-vite.org/guide/)：三入口和构建输出；工具链版本满足其要求。
- [Electron 原生模块](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)及 [better-sqlite3 安装说明](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md)：按锁定 Electron／架构验证原生依赖，必要时重建并正确 unpack。
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)：凭据存储按锁定版本使用可用异步接口，处理加密暂不可用及签名／更新后的系统重连。
- [Playwright Electron](https://playwright.dev/docs/api/class-electron)：Electron 自动化入口在维护方标为实验能力，T01 先做本机启动探针；测试工具限制不能替代手动实际验收。
- [SQLite FTS5](https://sqlite.org/fts5.html)：默认分词和 trigram 的短词边界不能自动满足中文一字／两字查询，本计划首版先保证子串正确性。
- [GitHub ref 更新](https://docs.github.com/en/rest/git/refs#update-a-reference)、[WebDAV 标准](https://www.rfc-editor.org/rfc/rfc4918.html)、[坚果云应用授权／限制](https://help.jianguoyun.com/?p=2064)：分别作为快进保护、条件操作和实际服务探针依据。



