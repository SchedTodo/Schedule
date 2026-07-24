# Schedule v2 迁移差异基线

本文档是 Schedule v2 后续迁移工作的权威基线。它记录 `main` 与 `release/1.2.0` 之间仍需处理的用户可见差异、已批准的非目标和暂缓事项。后续设计、实施计划和验收应引用本文档；若其他旧计划与本文档冲突，以本文档为准。

当前基线日期：2026-07-23。

## 状态与优先级

- `已完成`：当前 v2 已具备该能力，并有相应代码或测试覆盖。
- `待实施`：仍属于当前迁移范围，满足验收标准后才能关闭。
- `暂缓`：保留为未来工作，但不阻塞当前本地功能迁移。
- `非目标`：已经明确决定不实施，不应再作为缺口提出。
- `P0`：正式替代 1.2 前必须完成。
- `P1`：本地功能或桌面体验一致性工作。
- `P2`：发布完备性、清理或长期维护工作。

## 当前进度摘要

| 工作项 | 状态 | 当前结论 |
| --- | --- | --- |
| `GAP-01` 完整专注循环 | `已完成` | 四段循环、阶段通知和有效 Focus 记录已落地 |
| `GAP-02` Electron 生命周期 | `已完成` | 窗口、托盘、启动、外链和退出行为已验收 |
| `GAP-03` 提醒与通知展示 | `已完成` | 统一重算、休眠补发、边界语义和本地化展示已落地 |
| `GAP-04` 可重复测试时间基线 | `已完成` | 固定时钟、显式时区与跨时区复验已落地 |
| `GAP-05` 发布与端到端验证 | `已完成` | Web/Electron E2E、Windows x64 NSIS 和打包应用冒烟已验收 |
| `GAP-06` legacy 收口 | `待实施` | 直接建库已完成，legacy 源码与依赖清理尚未完成 |

## 已批准决策

### 不迁移 1.2 数据库

状态：`非目标`

Schedule v2 使用独立的新数据库，不迁移、导入或转换 1.2 的 `Schedule`、`Time`、`Record`、`Setting` 数据。`release/1.2.0` 只作为功能和用户可见行为参考，不作为数据兼容目标。

因此：

- 不要求保留旧日程、时间实例、完成状态、单次备注、专注记录或设置。
- 不要求提供旧数据库备份、恢复、幂等迁移或失败回滚流程。
- v2 Electron 已改为仅对新数据库执行一份完整 schema；v1 转换、备份、版本检测、迁移元数据和增量迁移代码及测试均已移除。
- 后续文档不得再把“1.2 数据迁移”列为待办或验收条件，除非用户重新批准范围变更。

### 同步功能暂缓

状态：`暂缓`

WebSocket 生命周期、跨设备同步、冲突处理、同步元数据、同步操作入口和同步遮罩暂不纳入当前迁移工作，不阻塞本地版本完成。与同步直接绑定的凭据存储、token 刷新和会话过期处理一并暂缓。

恢复同步前必须先单独批准协议、认证方式、冲突语义和安全存储设计，不默认复制 1.2 的实现。

### Tauri 暂不作为当前验收目标

状态：`暂缓`

`src` 继续保持浏览器可运行和平台无关，为未来 Tauri 适配保留边界；但 Tauri composition root 不阻塞当前 Web/Electron 迁移和发布。

## 已完成边界

状态：`已完成`

当前 Browser 和 Electron gateway 已覆盖：

- 日程创建、查询、列表、编辑、收藏、软删除、恢复、筛选和分页。
- 时间实例生成与范围查询、单次排除、单次备注和 Todo 完成状态。
- 月视图、周视图、Todo、详情、Database、Settings 和 Concentration 页面。
- 设置持久化、时区、周起始日、日历视图偏好和开机启动设置。
- 专注记录的创建、持久化和日程详情展示。
- 四个 Focus、三个 Small Break 和一个 Big Break 的完整专注循环、阶段通知，以及按 Todo 保存超过一分钟的连续 Focus 片段。
- 提醒计算、Electron 系统通知和托盘后台驻留的基础能力。
- 新数据库直接创建完整 schema；Database 页面通过服务端查询和远程分页展示日程。
- ANTLR 日程解析器及旧版解析器语义兼容测试。
- 单元和组件测试统一固定当前时间，并对关键时间场景执行跨宿主时区复验。
- Vue 代码通过稳定 DTO 和 `PlatformGateway` 工作，不暴露 Electron、Drizzle、SQLite 或 ANTLR context 类型。

“已完成”表示已有实现边界，不表示所有旧版交互细节已经一致；以下工作项仍优先于最终发布。

## 迁移工作项

### GAP-01：恢复完整专注循环

状态：`已完成`（2026-07-18）

优先级：`P1`

关闭前基线：专注页只有单段 Focus 倒计时和开始/暂停，需要恢复 1.2 用户可见的番茄钟流程，同时继续通过平台端口保存专注记录。

验收标准：

- 按设置执行 Focus、Small Break 和 Big Break 阶段。
- 默认循环为四个 Focus，前三次进入 Small Break，第四次进入 Big Break，然后重新开始。
- 阶段结束会自动切换，并显示当前阶段和累计专注时间。
- Focus/Break 阶段通知通过通知端口触发，不在 Vue 页面直接使用宿主 API。
- 切换 Todo 或离开页面时，超过一分钟的 Focus 记录保存到对应日程；Break 不记为专注记录。
- 使用固定时钟或 fake timer 覆盖阶段切换、暂停、恢复、Todo 切换和记录保存。

完成说明：

- `FocusCycle` 使用时间戳对账，按四个 Focus、三个 Small Break、一个 Big Break 的固定顺序自动循环，并正确排除暂停和 Break 时间。
- `FocusSession` 在暂停、阶段切换、Todo 切换和离页时关闭连续 Focus 片段，仅保存严格超过 60 秒的记录。
- 阶段切换通知通过 `PlatformGateway.notifications`、预加载 API 和 IPC 校验后交给 Electron notifier；Vue 不直接调用宿主 API。
- 页面展示当前阶段、Focus 序号、剩余时间、进度和累计专注时间，并保留显式开始、暂停和恢复操作。

关闭验证：

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.electron.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vitest.cmd run tests/integration/ipc/schedule-ipc.test.ts
.\node_modules\.bin\vite.cmd build
```

### GAP-02：对齐 Electron 窗口、托盘和启动行为

状态：`已完成`（2026-07-17）

优先级：`P1`

验收标准：

- 普通启动时窗口可见并最大化；开机启动时后台启动且不抢占前台。
- 最小化和关闭按钮的托盘行为有明确且一致的定义，并由 Electron 集成测试覆盖。
- 托盘的显示操作会恢复、显示、最大化并聚焦主窗口，退出操作会完整关闭数据库、定时器和托盘。
- 恢复明确批准的桌面快捷键；F5 刷新是否保留应在实现计划中作为显式决定，不静默遗漏。
- `window.open` 和外部链接只允许批准的协议，并通过安全的 Electron 外链适配器打开。
- 保持 `contextIsolation: true`、`sandbox: true` 和 `nodeIntegration: false`。

完成说明：

- 普通启动显示、最大化并聚焦主窗口；精确的 `--autostart` 启动保持隐藏且不聚焦。
- 托盘启用时，最小化和关闭按钮都隐藏到托盘；显式禁用托盘时保留原生最小化和关闭，避免产生不可恢复的隐藏进程。托盘“显示”按恢复、显示、最大化、聚焦的顺序处理主窗口。
- 托盘“退出”和应用退出共用一次性清理流程，完整释放数据库、提醒定时器、桌面快捷键和托盘。
- 已批准的桌面快捷键恢复；F5 仅在开发环境刷新，生产环境明确禁用。
- 所有新窗口请求均在应用内拒绝；仅 `https:` 外链可交给安全的 Electron 外链适配器。
- Electron 集成测试覆盖生命周期控制器、窗口、托盘和 IPC；沙箱外 Electron E2E 覆盖普通启动、开机后台启动、不安全新窗口请求和无托盘窗口关闭退出。

关闭验证：

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.electron.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vitest.cmd run tests/integration/electron tests/integration/ipc
.\node_modules\.bin\vite.cmd build
.\node_modules\.bin\vite.cmd build --config vite.electron-main.config.ts
.\node_modules\.bin\vite.cmd build --config vite.electron-preload.config.ts
.\node_modules\.bin\playwright.cmd test tests/e2e/electron/startup.spec.ts
```

### GAP-03：对齐提醒时间与通知展示

状态：`已完成`（2026-07-23）

优先级：`P1`

完成说明：提醒统一使用 `(lastCheckedAt, checkedAt]` 检查窗口；轮询、休眠恢复和提醒相关变更通过同一协调器重算。Todo 补发休眠期间所有仍有效的提醒，Event 仅在尚未结束时补发；通知按用户时区展示并保留未知小时、未知分钟语义。

验收标准：

- 明确定义提醒在轮询时间点之前还是之后触发，并用边界测试保证不会重复或永久漏发。
- 休眠恢复、设置变更、日程变更和 Todo 完成后会重新计算待提醒实例。
- 通知标题包含类型和日程名称。
- 通知正文按用户设置的时区展示可读时间，并保留未知小时、未知分钟的显示语义，不直接展示原始 ISO 字符串。
- 已完成、已排除、已软删除或禁用提醒的实例不会通知。

### GAP-04：建立可重复的测试时间基线

状态：`已完成`（2026-07-18）

优先级：`P0`

关闭前基线：部分首页测试使用固定在 2026 年 7 月的 fixture，但页面查询读取真实系统时间，导致测试随日期变化。所有依赖“今天”、逻辑日、到期状态、日历范围和提醒窗口的测试必须确定化。

验收标准：

- 单元和组件测试不依赖执行机器的当前日期、时区或 locale。
- 首页、Todo、日历、详情、专注和提醒测试统一使用固定时钟或 fake timer。
- 项目规定的 lint、类型检查、单元测试和 Web 构建从任意日期运行均通过。
- 测试不得通过放宽断言或把 fixture 日期不断推迟来规避时间依赖。

完成说明：

- Vitest 全局 setup 将无参数 `Date`、`Date.now()` 和 `Temporal.Now.instant()` 固定到 `2026-07-13T04:00:00.000Z`，显式日期构造保持原行为。
- 共享测试支持模块统一提供 `TEST_NOW`、`Asia/Shanghai` 和 `zh-CN`；首页、Todo、日历、详情、专注和提醒测试不再读取真实当前日期。
- 时间和文本断言显式传入业务时区与 locale，生产运行时的系统时区和 locale 行为未被修改。
- 2026-07-18 在 `America/Los_Angeles` 宿主时区下复验六类时间敏感套件，结果为 6 个文件、27 个测试全部通过；完整核心套件为 44 个文件、233 个测试全部通过。

关闭验证：

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
$env:TZ='America/Los_Angeles'
.\node_modules\.bin\vitest.cmd run tests/unit/features/home-workspace.test.ts tests/unit/features/todo-sidebar.test.ts tests/unit/features/occurrence-calendar.test.ts tests/unit/features/schedule-detail-presentation.test.ts tests/unit/features/concentrate-page.test.ts tests/unit/application/alarm-scheduler.test.ts
Remove-Item Env:TZ
.\node_modules\.bin\vite.cmd build
```

### GAP-05：补齐发布与端到端验证

状态：`已完成（2026-07-24）`

优先级：`P0`

完成结论：Web E2E 已覆盖日程新增、编辑、删除、Todo 完成、月/周切换、解析错误、设置和专注流程；Electron E2E 已覆盖 SQLite 重启持久化、窗口安全边界、托盘、开机启动设置、通知 IPC 调用链和安全外链。Windows x64 NSIS 可通过 `package:win` 本地复现，打包应用从 `file:` 加载 v2 产物，renderer 不暴露 Node，且产物中未发现 legacy `src/main`、`src/preload` 或 `src/renderer` 路径。

验证结果：

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`：46 个文件、253 项通过
- `pnpm test:integration`：10 个文件、56 项通过
- `pnpm build:web`
- `pnpm build:electron`
- `pnpm release:win`：5 项 Web E2E、10 项 Electron E2E、Windows x64 NSIS 和 1 项打包应用冒烟全部通过

验收标准：

- 提供可复现的 Windows 打包命令和安装产物；macOS、Linux、签名和自动更新只有在单独批准目标平台后才成为必需项。
- Web E2E 覆盖日程新增、编辑、删除、Todo 完成、月/周切换、解析错误、设置和专注流程。
- Electron E2E 覆盖本地持久化、窗口安全边界、托盘、开机启动设置、通知端口和安全外链。
- `package.json` 中的 E2E、构建和发布脚本均有实际文件与 CI 或本地验证流程对应，不保留空脚本。
- 生产构建不依赖 legacy 源码、开发服务器或未声明的本机环境。

### GAP-06：完成 legacy 源码切换与文档收口

状态：`待实施`

优先级：`P2`

部分进展：v2 已移除所有数据库迁移路径，新数据库只执行 `src-electron/adapters/db/schema.sql`；Database 页面也已切换为远程分页数据表。以下仍是本项的剩余验收范围：

验收标准：

- 删除不再参与 v2 运行的 `src/main/**`、`src/preload/**`、`src/renderer/**`、`src/prisma/**` 和旧解析器测试。
- 删除仅被 legacy 代码使用的依赖、别名、环境变量和构建配置。
- README 和架构文档只描述实际存在的 v2 命令、能力和限制。
- 删除 legacy 源码前后运行同一套验证，证明 v2 不通过旧别名或遗留文件间接工作。

## 账户与身份边界

状态：`暂缓`

1.2 的 Google 登录、头像、用户菜单和登录反馈主要服务于同步。当前本地版本固定显示 Guest，不把账户体系作为本地功能完成条件。

如果未来恢复账户能力，应作为独立设计处理，并至少明确：

- 登录的产品目的是否仍只用于同步。
- 浏览器与 Electron 的认证流程。
- token、刷新凭据和会话过期数据的安全存储边界。
- Guest 与登录用户之间的数据归属和切换行为。

## 执行顺序

`GAP-01` 至 `GAP-05` 已完成。剩余工作默认按以下顺序推进；每一项应有独立设计、TDD 实施计划和验证结果：

1. `GAP-06`：删除 legacy 实现并完成文档收口。

同步、账户和 Tauri 不在上述执行序列中，必须经用户重新批准后才能进入实施计划。

## 维护规则

- 新发现的 1.2 行为差异先记录在本文档，再编写设计或实施代码。
- 关闭工作项时，必须附上对应测试或验证命令，并把状态改为 `已完成`。
- 范围变更必须记录在“已批准决策”，不能只修改某个实施计划。
- 不得把已批准的非目标重新包装成隐含发布要求。
- 本文档记录产品与迁移范围；具体代码步骤继续写入 `docs/superpowers/plans/`。
