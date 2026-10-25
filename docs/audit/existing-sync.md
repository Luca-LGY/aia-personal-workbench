# 既有同步与接管审计（T00）

观测时间：2026-10-25T20:54:47+08:00（Asia/Shanghai）。主库 `/Users/lgy/Documents/我的AI档案`；本次只读检查，未执行同步工具、fetch／pull／push、配置编辑、启动项启停或真实云端操作。

## 当前本机证据

| 检查项 | 结果 | 边界 |
| --- | --- | --- |
| Git 工作区 | main；暂存、未暂存、未跟踪和未解决冲突均为空 | 使用 GIT_OPTIONAL_LOCKS=0 的 status／diff／rev-parse 查询。 |
| 本机 HEAD | cc59c3a8e160ad6ec15226316ed7b54f97d18a90 | 提交时间 2026-10-25T19:45:45+08:00。 |
| 上游差异 | origin/main；ahead=0，behind=0 | 相对本机缓存引用；本次未主动请求云端最新 HEAD。 |
| 远端配置 | fetch 与 push 均为 https://github.com/Luca-LGY/my-ai-archive.git | 只查询 URL；未读取 Git 凭据。 |
| 本机同步配置 | paused=false；notifications_enabled=false；branch=main | 仅读取已知无令牌配置中的白名单字段。 |
| 目的地身份 | Luca-LGY/my-ai-archive；repository_id=1423137931 | 来自本机配置与 14_GitHub同步.md；当前云端 Private／写权限未另发 API 复核。 |
| 本机状态 | synced；reason=None | 状态文件来自原后台；审计不重写状态。 |
| 状态核对时间 | 2026-10-25T20:53:57+08:00 | 2026-10-25 20:49:56 至 20:50:56 的先前连续观测亦为 synced，证明状态持续刷新。 |
| 最后成功时间 | 2026-10-25T20:53:57+08:00 | 失败重试不会自动刷新该字段；本次未制造写入来验证上传。 |
| 状态 HEAD | cc59c3a8e160ad6ec15226316ed7b54f97d18a90 | 与本机 HEAD 一致。 |
| 人工 Git 操作 | MERGE_HEAD、rebase-merge、rebase-apply 均不存在 | 未运行中止、重置或清理命令。 |
| 设备身份 | 主要Mac；短标识 cb5738bd | 既有身份已存在，应保留，未重新生成。 |
| 设备成功记录 | 同步记录/主要Mac-cb5738bd.md | 本机回执 events 数量为 0；未读取或复制回执正文。 |
| 同步锁 |  .git/archive-sync.lock 存在 | PID 788 的定向 lsof 瞬时查询无打开项（退出 1）；不据此断言全局无占用，接管前须实际获排他锁。 |
| LaunchAgent | com.local.my-ai-archive-sync 已加载；PID 788；last exit=0 | 初次受限查询不可见；后以获准的定向只读系统查询确认。 |
| 后台进程 | Python 3.14 进程运行；观测持续时间 04-10:27:53 | 只查询 PID、运行时长和可执行路径，未读取进程环境或无关命令行。 |
| 启动策略 | RunAtLoad=true；KeepAlive=true；ThrottleInterval=60 | 来自既有 plist；未重载服务。 |
| 日志元数据 | sync.log=0 字节；sync-error.log=65,508 字节 | 错误日志最后修改 2026-10-24T21:03:36+08:00；未读内容，不能解释历史错误或据此判定当前失败。 |

当前证据没有发现本机未提交修改、相对缓存上游的未传提交或待发成功记录。该结论限本机观测时点；未把后台的最近成功状态替代本次主动云端校验，也未验证 Windows 此刻在线。

## 真实配置与程序路径

| 对象 | 绝对路径／值 |
| --- | --- |
| 同步入口 | /Users/lgy/Documents/我的AI档案/同步工具/sync.py |
| 状态显示 | /Users/lgy/Documents/我的AI档案/同步工具/status_display.py |
| 成功回执 | /Users/lgy/Documents/我的AI档案/同步工具/sync_receipts.py |
| 本机配置 | /Users/lgy/Documents/我的AI档案/.git/archive-sync.json |
| 本机状态 | /Users/lgy/Documents/我的AI档案/.git/archive-sync-status.json |
| 本机回执和设备身份 | /Users/lgy/Documents/我的AI档案/.git/archive-sync-receipts.json |
| 锁 | /Users/lgy/Documents/我的AI档案/.git/archive-sync.lock |
| 中文状态视图 | /Users/lgy/Documents/我的AI档案/同步状态.md（Git 忽略，不上传） |
| 登录启动项 | /Users/lgy/Library/LaunchAgents/com.local.my-ai-archive-sync.plist |
| Python | /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 |
| GitHub CLI | /Users/lgy/.local/share/my-ai-archive-tools/v2.102.0/gh_2.102.0_macOS_arm64/bin/gh |
| 标准日志 | /Users/lgy/Library/Logs/MyAIArchiveSync/sync.log |
| 错误日志 | /Users/lgy/Library/Logs/MyAIArchiveSync/sync-error.log |

启动项以 `sync.py --repo /Users/lgy/Documents/我的AI档案 --watch` 运行，工作目录为同一主库。没有发现另建复制主库的必要。未读取 `~/.config/gh`、Keychain、应用密码、环境密钥或其他凭据储存。

## 已有机制（源码核对）

- `sync.py:67–85,387–406`：对 Git 跟踪及未忽略文件生成内容指纹；2 秒循环，稳定约 10 秒后处理，约 60 秒检查远端／重试。休眠、网络与调用耗时会影响实际间隔。
- `sync.py:88–111,252–266`：通过 `.git/archive-sync.lock` 的操作系统排他锁避免旧同步程序并发；此锁不替编辑器提供事务隔离，也不能自动约束未来的新协调器。
- `sync.py:131–166,271–277`：目标固定为批准的 origin、main、仓库 ID，并检查 Private 和写权限；先扫描再上传固定提交，不使用强推。
- `sync.py:168–224`：检查常见凭据格式、50 MiB 大文件、符号链接、嵌套仓库、状态文件入库及大小写／Unicode 路径碰撞。检查包含尚未上传历史中的全部新 blob；不能把这些格式规则当作完整敏感信息识别。
- `sync.py:329–384`：本机版本保存、fetch、比较本机与远端、快进或三方合并、上传、确认成功记录。`git add -A` 会收集全部非忽略修改，所以 T23 前不能将工程测试文件放进真实主库。
- `sync.py:279–327`：合并先用 `merge-tree` 预检，检查忽略文件碰撞、HEAD 与工作区未变后才应用；真实冲突保留双方历史并返回 conflict，不向日常文件写冲突标记。
- `sync_receipts.py`：设备独立身份、确认后生成成功记录；未确认尝试留 `.git`。没有修改或只有下载不新增上传记录。
- `status_display.py:38–51`：初始化可能补写 `.git/info/exclude`；因此此次没有运行文档所列 `--status` 或导入构造 `Syncer`，而是只读 JSON。

## 其他设备与独立采集

- `14_GitHub同步.md:210–226` 与 README 记录学习 Windows-LGY 已部署，当前主库为 `D:\Codex\LGY\我的AI档案`，任务名 `MyAIArchiveSync`，设备成功记录为 `同步记录/学习Windows-LGY-10648cee.md`。本次只枚举其已同步到 Mac 的记录文件，未访问 Windows 运行状态；Mac ↔ Windows 实机互传和重新登录恢复仍按原文列为未验收，不能因本机绿色状态称两端完成。
- 佳明现有归档位于 `/Users/lgy/Documents/我的AI档案/运动`，含状态、数据日期目录、索引、质量和待补队列。README 记载独立的 ChatGPT 每日／每周和缺项补漏采集安排；本次只读取相关结构说明，未访问账号定时任务、未调用 Garmin、未变更任何采集安排。档案文件上传与佳明采集是不同环节，T15 应消费既有归档。
- `.github/workflows/yimu-sync.yml` 存在一木每日同步定义，cron=`10 1 * * *`；另有 `yimu-build.yml` 发布定义及 `integrations/yimu-cloud` 源码。仅核对定义存在，未请求云端工作流状态、授权或数据，不能称当前云端任务健康。
- 既有文档将“GitHub ⇄ 本地同一份档案 ⇄ 坚果云；APP 读写该本地档案”列为后续待接入能力。此次没有寻找坚果云应用密码、连接 WebDAV 或试写云端。

## 未传内容的复核方式

T23 前重新做只读复核，并分别记录证据，不能只看 `同步状态.md` 的颜色：

1. 使用 `GIT_OPTIONAL_LOCKS=0` 的 `git status --porcelain=v1 --untracked-files=all`、`git diff --stat` 与 `git diff --cached --stat` 查看未提交、暂存和未跟踪改动；不打印个人正文。
2. 用 `git rev-list --left-right --count HEAD...origin/main` 区分本机领先与落后；该引用可能过期。获准联网时，通过已有连接只读核对远端 main 的 SHA 和仓库 ID／Private，不能把陈旧缓存当作远端现值。不要为审计触发原同步脚本。
3. 只读 `.git/archive-sync-receipts.json` 的事件数量与已知身份字段，查看是否有已上传正文但未发布成功记录的情况；不要删除或重建身份来清队列。
4. 检查 merge／rebase 标记、本机实时状态更新时间、后台进程和锁；状态超过 3 分钟未更新须另查后台或休眠。锁文件存在不代表锁正被持有；接管须真正取得双方认可的排他机制。
5. 若有本机领先提交，用差异文件名与提交数盘点；必要内容审阅限于相关来源并避免日志泄密。保存工作区、索引、HEAD 和未传对象后才能接管，不运行 reset --hard、clean 或强推。

## T23 接管与回滚建议（本次均未执行）

1. 接管前重读 AGENTS／README／14_GitHub同步，完成 T22 的可恢复备份；保存普通档案哈希清单，以及原 `.git`、本机配置／回执、plist 与工具版本的安全本机备份。确认设备身份、未传提交和回执已被保留，凭据通过本机授权重连，不复制到新设备或写入工程。
2. 新协调器在测试目录完成断网、恢复、双方并发、删改冲突和回执验证后，再对真实库实施写入隔离。先将原工具设为暂停并停止其 LaunchAgent，复核进程退出和排他锁；保持原文件和启动项备份，不删原库或原身份。此步骤只在 T23 执行。
3. 在旧写入器确已停止的条件下，重做清单和未传差异，确认同一档案根／Git 历史和坚果云目标；新协调器成为唯一同步写入器。外部编辑仍作为受控输入；不让旧后台与新协调器各自上传或覆盖。
4. 原主库路径如需迁移，先完整校验普通文件及隐藏元数据，更新所有明确入口，保留可回退原位；不得以这次 202 文件清单替代迁移当刻的哈希／来源核对，也不得遗漏附件、历史版本或一木集成文件。
5. 回滚时先停止新协调器并保存其尚未传出的变更、冲突副本、日志和队列；核对新旧差异后再恢复原路径、原工具、原 plist 及原设备身份。不得为回滚覆盖新产生的档案或重置远端。仅恢复旧写入器一个服务，检查真实权限、HEAD、未传状态及最终回读。
6. 若暂缺坚果云应用密码或真实目标授权，保留待验证状态并继续其他已授权工作；不能把模拟协议通过写成真实双向接管完成。佳明原采集、Windows 原后台、一木云端授权均不因本机 APP 接入被擅自改动。

## 审计边界

本次已读取源规则、同步相关文档与必要源码，并核对本机文件清单、配置白名单、Git 元数据、原启动项和定向进程状态。没有改变真实档案、服务或云端；没有制造测试数据、读取凭据正文、打开个人附件，亦没有扫描无关私人目录。历史错误日志内容、Windows 当前运行、云端最新树／权限、佳明任务实时状态和一木云端运行仍未实测。
