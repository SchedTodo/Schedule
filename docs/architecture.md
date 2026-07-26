# Schedule v2 重构设计与决策

本文档是 Schedule v2 重构完成后的权威设计记录，合并原 `docs/superpowers` 中的设计、实施计划与迁移差异基线。它描述当前 `main` 的长期约束和关键行为，不再承担逐任务执行清单的职责。

若历史提交、`release/1.2.0` 或旧文档与本文冲突，以本文和当前代码、测试为准。`release/1.2.0` 仅作为不可修改的旧版行为参考；v2 开发继续在 `main` 上进行。

## 重构结论

本轮重构已经完成：

- 产品代码已重建为可独立运行的 Web 应用，Electron 只作为宿主适配层。
- legacy 运行源码、旧构建配置和旧专用依赖已删除；解析器兼容性测试被刻意保留。
- 日程、实例、Todo、设置、专注、提醒、桌面生命周期、本地持久化和 Windows 发布链路均已迁移并验证。
- Web/Electron 边界使用稳定 DTO、窄平台端口与 Zod 运行时校验。
- Windows x64 NSIS、Web E2E、Electron E2E 和打包产物冒烟已有可复现入口。

同步、账户/认证和 Tauri 宿主不属于本轮完成范围。macOS、Linux、代码签名、自动更新和 1.2 数据迁移也不在当前承诺内。

## 总体架构

依赖方向固定为：

```text
Vue 页面与组件
       │
       ▼
应用服务 / 平台无关领域逻辑
       │
       ▼
PlatformGateway、端口、Zod DTO
       ▲
       │
浏览器内存适配器  或  Electron preload / IPC / SQLite 适配器
```

### `src`：平台无关产品层

`src` 必须能在普通浏览器中运行，包含 Vue 应用、领域模型、应用服务、契约、解析器、Pinia 客户端状态和浏览器适配器。

- 浏览器入口在没有宿主 API 时组合内存网关。
- Vue 只消费 DTO 和 `PlatformGateway`，不得直接访问 preload、IPC 或数据库。
- `src` 不得导入 Electron、`node:*`、`better-sqlite3`、Drizzle schema、ANTLR context 或其他宿主类型。
- Pinia 只保存客户端状态；异步业务操作留在 feature/application 层。除非另有批准，不引入 TanStack Query。

### `src-electron`：宿主适配层

`src-electron` 包含 Electron composition root、窗口/托盘生命周期、preload、IPC、SQLite、通知、开机启动和安全外链适配器。

- `src-electron` 可以向内依赖 `src` 的契约和平台无关逻辑，反向依赖禁止。
- preload 只暴露具名的 `scheduleHost` 方法，不暴露通用 IPC。
- 主进程负责组合适配器和注册 handler，不承载 Vue 展示逻辑。
- Electron、SQLite、Drizzle row 和宿主异常不得越过平台边界进入组件。

### 运行时边界

跨进程、文件和持久化数据在验证前均视为 `unknown`：

- IPC 输入和服务返回值由同一组契约校验。
- preload 再次校验 IPC 返回值。
- `host-gateway` 校验暴露的宿主 API 形状并映射为 `PlatformGateway`。
- 设置 JSON 读取和更新分别通过设置 DTO 与更新输入 schema。
- renderer-facing 错误使用稳定应用错误，不泄露 SQL、文件路径或宿主异常细节。

## 核心技术决策

| 领域   | 决策                                                                                    |
| ------ | --------------------------------------------------------------------------------------- |
| 工具链 | Node.js 24 LTS；使用 `packageManager` 固定的 pnpm 11.17.0；ESM、TypeScript strict、Vite |
| Web    | Vue 3、Vue Router、Pinia、Naive UI、原生 CSS token                                      |
| 时间   | Temporal 表达领域时间；边界序列化；不引入 Moment 或新的 Luxon 使用                      |
| 解析   | ANTLR 4 TypeScript target；grammar 无目标语言 action；生成文件提交但禁止手改            |
| 校验   | Zod 校验进程、文件、持久化和平台边界                                                    |
| 持久化 | Drizzle + `better-sqlite3`，仅存在于 Electron                                           |
| 测试   | Vitest 覆盖单元/契约/parser/integration，Playwright 区分 Web、Electron 和打包产物       |
| 发布   | 当前只验证 Windows x64 NSIS，本地可复现，不自动上传或签名                               |

## 日程语言与时间语义

### Parser

- grammar：`src/parser/grammar/Schedule.g4`
- 生成目录：`src/parser/generated/`
- 生成：`pnpm parser:generate`
- 一致性检查：`pnpm parser:check-generated`

ANTLR 只负责识别语法并产生平台无关 AST；Temporal evaluator 负责日期糖、未知时间、时区、重复规则、`by[...]`、排除和实例展开。

`release/1.2.0` 仍是可观察语法行为的兼容基准。保留的 57 组 legacy parser 用例逐名覆盖旧版接受/拒绝规则、日期与时间糖、重复/排除、未知时间标记和时区解释；测试使用固定时钟和显式时区。任何有意不兼容都必须另行批准。

### 时区

- 未显式指定时区的规则使用保存时的 `settings.timeZone`。
- 保存前将相对日期、时区缩写和省略时区规范化为完整日期与 IANA 时区。
- 同一次解析结果同时用于规范化文本和实例展开，避免两条路径产生偏差。
- 实例的 `start`/`end` 持久化为 UTC instant；展示、日历分组和查询边界按当前应用时区转换。
- 修改全局时区不会重新解释或重建已有实例；已保存规则已经包含其创建时解析出的时区。
- `createdAt`、`updatedAt` 等审计时间不是日程实例时间。

显式输入的 `daily` 必须在规范化后保留；只有隐式默认 daily 可以省略。

## 数据与业务语义

### 新数据库初始化

`src-electron/adapters/db/schema.sql` 是唯一完整 schema，包含 schedule、occurrence、settings 和 concentration record 结构及约束。

- 数据库文件不存在时，启动过程创建文件并执行完整 schema。
- 文件已存在时只打开连接，不检查版本、不升级、不备份也不转换。
- 不维护 migration metadata 或增量升级承诺。
- 1.2 的 Schedule、Time、Record、Setting 数据不导入、不兼容、不恢复。

### 日程与实例

日程支持创建、查询、编辑、收藏、软删除、恢复、筛选和服务端分页。普通列表隐藏已删除日程；Database 页面默认同时显示 active/deleted，也保留显式删除状态查询能力。

实例是独立持久化实体。日程规则更新时按 `(start, end, startMark, endMark)` 对账：

- 匹配项复用原 ID、comment、done 和创建时间，并恢复可能的软删除状态。
- 新实例插入新行。
- 不再由 recurrence 或 exclusion 生成的历史实例保留并标记软删除。
- 对账不得先物理删除全部实例。
- Event 与 Todo 不允许互相改变类型。

手动删除单个可见实例的语义是“排除”：

- 将实例标为 excluded。
- 把带未知时间标记的具体时间表达式追加到 `exclusionCode`。
- 不把该实例标记为 schedule-wide soft delete。
- 批量排除在一个事务中完成；任一 ID 无效则整体失败。

日程整体删除会在一个事务中软删除日程、关联实例和专注记录。已删除日程详情只读。

### 两类备注

- Schedule Comment 属于整个日程，用于 Add/Edit 和月/周日历 Tooltip。
- Occurrence Comment 属于单次实例，在详情 Times 表格中编辑。

两者不得互相覆盖。规则更新后，匹配实例继续保留自身 Occurrence Comment。

### Todo 与逻辑日

完成状态属于 occurrence，不属于 schedule。Todo 查询返回：

1. 每个 Todo 最早的未过期实例；
2. 当前逻辑日内的全部实例；
3. 按 occurrence ID 去重后的并集。

逻辑日按设置中的 day start 和应用时区计算；早于 day start 的墙钟时间属于前一个逻辑日。Todo 截止展示与颜色规则保留旧版语义：过期红、今天橙、明天黑、后天及以后灰；完成态为灰，但过期优先。

### Database

Database 页面使用远程分页的 `NDataTable`：

- 默认页大小 10，可选 5、10、15、20。
- 搜索、日期范围、类型或星标条件变化时回到第一页。
- 文本搜索匹配日程标题和备注：空格连接 AND 条件，`|` 连接同组 OR 条件，`+` 作为普通字符。
- 过滤后按更新时间倒序、ID 升序稳定排序，再执行远程分页。
- 省略 `deleted` 返回 active 与 deleted；显式 `false`/`true` 分别过滤。
- 星标按钮只在“不筛选”和“只看星标”之间切换。
- Restore 只显示在已删除行，成功后刷新当前页。
- 查询失败不以空结果覆盖当前 rows 或 total。

## 界面与客户端状态

v2 采用“忠实迁移可见行为、重建内部架构”的策略：旧版页面层级、导航、关键快捷键、月/周/Todo/详情/设置交互作为参考，但不复制 Axios、EventBus、旧 Store、Prisma、Luxon 或 Electron 耦合。

- 顶部导航为 Home、Database、Settings、Help，右侧本地 Guest；页脚和顶部栏固定，只有内容区滚动。
- 首页保留可折叠 Todo 侧栏、月/周视图和共享 Add/Edit modal。
- 临时 month/week 选择存入 runtime Pinia store，路由往返时保留，但不写入持久化偏好；`preferences.calendarMode` 仅表示下次启动默认值。
- 月视图按当前时区分组实例；周视图按逻辑日定位并保留只影响视觉、不写持久化的拖动偏移。
- 周视图颜色由 schedule ID 稳定散列，避免刷新与截图抖动。
- Name 和 rTime 必填；exTime 和 Comment 可选；键盘提交与按钮提交走同一校验入口。
- 设置中的 `weekStart` 全链路使用 ISO weekday `1`（周一）至 `7`（周日）。
- 时区选项来自 `Intl.supportedValuesOf('timeZone')`，补充 `UTC` 和当前有效存储值；不支持时退化为 UTC、系统区和存储值。
- Appearance 只保留 Theme，不保留已移除的 Compact Density。
- `Ctrl+1…7` 只在 Add modal 聚焦的 rTime/exTime 中插入下一个周一至周日；应用导航和 modal 快捷键以 Help 页面为准。

## 专注循环

专注逻辑位于平台无关状态机，固定循环为：

```text
Focus 1 → Small Break → Focus 2 → Small Break
→ Focus 3 → Small Break → Focus 4 → Big Break → Focus 1
```

- 用户首次显式开始；阶段结束后自动进入并开始下一阶段。
- 状态机按时间戳对账，不假设 interval 每秒准时执行；延迟回调可一次跨越多个阶段。
- 暂停保留阶段和剩余时间；Break 和暂停时间不计入累计 Focus。
- 连续 Focus 片段在暂停、阶段结束、Todo 切换或离页时关闭。
- 只有严格大于 60 秒且绑定 Todo 的单个 Focus 片段才保存；Break 不保存。
- 切换 Todo 不重启番茄循环，先关闭并 flush 旧 Todo 的片段，再把后续时间归给新 Todo。
- 阶段通知经 `PlatformGateway.notifications` 到 Electron notifier；通知或记录写入失败不停止或倒转计时。
- 计时器状态不跨页面或应用重启持久化，Focus 次数和阶段顺序当前不可配置。

## 提醒与通知

提醒由平台无关 `AlarmCoordinator` 统一重算，Electron 只提供 30 秒轮询、系统恢复事件和 notifier。

### 检查边界

检查窗口为左开右闭 `(lastCheckedAt, checkedAt]`：

- 等于本次检查时刻的提醒本次触发。
- 等于上次成功边界的提醒不重复触发。
- 只有候选读取和本轮处理成功后才推进成功边界。
- 进程内按 `occurrenceId + alarmAt` 去重；通知失败不记录去重键，以便重试。
- 启动时以当前时间建立基线，不追溯应用未运行或系统关机期间的提醒。

轮询、休眠恢复，以及成功的设置更新、日程创建/更新/删除/恢复、实例排除、Todo 完成/恢复都调用同一 `recalculate()`。评论、收藏和专注记录变化不触发重算。

### 过滤与补发

已完成、已排除、实例软删除、所属日程软删除或禁用提醒的实例不会通知。

- Todo 在休眠恢复或相关变化后，补发全部已到点且仍有效的提醒。
- Event 仅在检查时刻严格早于结束时补发；等于或晚于结束时不补发。
- Event 使用开始时间，Todo 使用截止时间。

通知标题为 `Event: <名称>` 或 `Todo: <名称>`。正文由平台无关 formatter 按用户 IANA 时区生成，不展示原始 ISO，并保留 `09:30`、`09:?`、`?:30`、`?:?` 四种时间已知状态。Electron notifier 不负责业务格式化。

## Electron 生命周期与安全

- 正常启动在 `ready-to-show` 后显示、最大化、聚焦。
- 精确包含 `--autostart` 时后台启动，不显示、不最大化、不聚焦。
- 启用托盘时，最小化和关闭都隐藏到托盘；托盘 Show 恢复、显示、最大化、聚焦。
- 显式禁用托盘时保留原生最小化/关闭，避免不可恢复的隐藏进程。
- Tray Quit 先进入 quitting 状态再调用 `app.quit()`。
- 清理路径幂等，并尝试释放数据库、提醒定时器、快捷键和托盘；单项失败不阻止其他清理。
- F5 只在开发环境注册；生产环境禁用。
- 所有 `window.open` 请求都在应用内拒绝；只有 `https:` 可经安全外链适配器交给系统浏览器。
- 主窗口保持 `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`。

生命周期控制器依赖窄接口，Electron 对象只存在于适配器边缘。系统外链失败和清理异常通过主进程错误路径报告，不产生未处理 rejection。

## 测试与发布决策

### 可重复时间基线

Vitest 默认固定在：

- instant：`2026-07-13T04:00:00.000Z`
- 时区：`Asia/Shanghai`
- locale：`zh-CN`

无参数 `Date`、`Date.now()` 和 `Temporal.Now.instant()` 使用同一 instant；显式 Date 构造保持原语义。格式化与日期边界测试必须显式传入业务时区/locale。只有需要控制 interval 的专注测试启用 fake timers。

### 分层验证

- Web E2E 在 Chromium + Vite production preview 中覆盖平台无关用户流程。
- Electron E2E 只覆盖 SQLite 重启持久化、preload/IPC、窗口安全、托盘、开机启动、通知端口和安全外链。
- 打包冒烟直接启动 `release/win-unpacked/schedule.exe`，验证 `file:` 入口、preload、renderer 隔离、正常退出和 NSIS 文件存在。
- 测试替换 notifier、外链和 login item API，不弹真实通知、不打开真实外链、不修改真实开机启动项。

当前 Windows 发布是本地流程，不新增 CI、不上传、不签名、不自动更新。支持范围和产物路径见[Windows 本地发布](development/windows-release.md)；Electron GUI 异常按[Electron E2E 排障指南](development/electron-e2e-troubleshooting.md)定位。

## 已批准的暂缓与非目标

| 项目                     | 状态   | 恢复条件                                                 |
| ------------------------ | ------ | -------------------------------------------------------- |
| 1.2 数据库导入/转换/备份 | 非目标 | 必须重新批准范围；不得隐含为发布要求                     |
| 同步与 WebSocket         | 暂缓   | 先批准协议、认证、冲突语义和安全存储                     |
| 账户、Google 登录和凭据  | 暂缓   | 先明确产品目的、Browser/Electron 流程、会话和数据归属    |
| Tauri composition root   | 暂缓   | 在 `src-tauri` 独立实现现有端口，不向 `src` 泄漏宿主类型 |
| macOS/Linux 打包         | 非目标 | 明确目标平台并补齐相应验证                               |
| 签名、上传、自动更新     | 非目标 | 具备发布账户/凭据并单独设计                              |
| 跨进程持久化提醒队列     | 非目标 | 需要新的投递与去重设计                                   |

当前没有剩余的已批准迁移缺口。新发现的旧版差异先判断是否属于上述非目标/暂缓项；若要改变范围，必须先更新本文的决策记录并获得批准。

## 开发与验证

| 场景               | 命令                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- |
| 安装               | `corepack enable`；`pnpm install --frozen-lockfile`                                      |
| Web 开发/构建      | `pnpm dev:web`；`pnpm build:web`                                                         |
| Electron 构建/启动 | `pnpm build:electron`；`pnpm start:electron`                                             |
| 静态检查           | `pnpm lint`；`pnpm typecheck`                                                            |
| 测试               | `pnpm test:unit`；`pnpm test:integration`；`pnpm test:e2e:web`；`pnpm test:e2e:electron` |
| Parser             | `pnpm parser:generate`；`pnpm parser:check-generated`                                    |
| Windows 打包/冒烟  | `pnpm package:win`；`pnpm test:package:win`                                              |
| Windows 完整发布   | `pnpm release:win`                                                                       |

Web 基础变更的最低验证：

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vite.cmd build
```

涉及 Electron、SQLite、IPC、parser、E2E 或发布的改动，应追加对应的 typecheck、integration、生成一致性、Electron build、Playwright 或打包命令。Electron E2E 和打包测试会启动 GUI，必须在 Windows 桌面会话的正确执行边界运行。

Git 提交规则见[Git 提交规范](development/git-conventions.md)。
