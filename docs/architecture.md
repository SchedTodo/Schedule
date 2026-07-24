# Schedule v2 架构

## 依赖方向与组合

`src` 是浏览器可运行且平台无关的产品层。Vue 组件只依赖稳定 DTO 与 `PlatformGateway`，不得接收 Electron、Drizzle、SQLite 驱动或 ANTLR context 类型。

- 浏览器入口 `src/main.ts` 在不存在宿主 API 时组合 `createInMemoryGateway`。
- Electron 预加载层只暴露具名的 `scheduleHost` 方法；每次调用按 IPC 契约校验结果。
- Electron 主进程注册对应的 IPC handler，并把调用交给 SQLite、通知、窗口和其他适配器。`src-electron` 只向内依赖 `src` 的契约、应用服务和端口。
- `src/platform/host/host-gateway.ts` 先以 Zod 校验预加载 API 的形状，再将其映射为 `PlatformGateway`。

跨进程、持久化与网络形 DTO 均由 Zod 在边界校验；Vue 不直接访问宿主或数据库 API。

## 日程解析器

- 语法文件：`src/parser/grammar/Schedule.g4`
- 生成目录：`src/parser/generated/`
- 生成：`pnpm parser:generate`
- 一致性检查：`pnpm parser:check-generated`

生成代码已提交到仓库，仅由生成命令更新，不能手工编辑。

## SQLite 生命周期

Electron 使用 `src-electron/adapters/db/schema.sql` 作为唯一完整 schema。若目标数据库文件不存在，`initializeScheduleDatabase` 执行该 schema 创建新的 v2 数据库；若文件已存在，只打开连接，不执行版本检测、转换或升级。

1.2 数据导入、兼容、转换和备份均是非目标。数据库实现位于 `src-electron`，不会泄漏到 `src` 或 Vue。

## 开发、验证与发布

环境要求为 Node.js 24 LTS 与由 `package.json#packageManager` 固定的 pnpm 11.17.0。

| 场景 | 命令 |
| --- | --- |
| 安装 | `corepack enable`；`pnpm install --frozen-lockfile` |
| Web 开发与构建 | `pnpm dev:web`；`pnpm build:web` |
| Electron 构建与启动 | `pnpm build:electron`；`pnpm start:electron` |
| 静态检查 | `pnpm lint`；`pnpm typecheck` |
| 测试 | `pnpm test:unit`；`pnpm test:integration`；`pnpm test:e2e:web`；`pnpm test:e2e:electron` |
| Parser 生成 | `pnpm parser:generate`；`pnpm parser:check-generated` |
| Windows 打包与冒烟 | `pnpm package:win`；`pnpm test:package:win` |
| Windows 发布链路 | `pnpm release:win` |

Electron E2E、打包和打包应用冒烟会启动 GUI 子进程。当前仅验证 Windows x64 NSIS；签名、自动更新、macOS 和 Linux 打包尚未实现。

## 未来 Tauri

Tauri 适配应在 `src-tauri` 建立独立 composition root，并针对既有平台契约实现适配器。不得向 `src` 引入 Tauri 类型、API 或其他宿主类型。同步、账户、认证和 Tauri 宿主均暂缓，需经单独设计与批准后再实施。
