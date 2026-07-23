# GAP-05 发布与端到端验证设计

**状态：** 已确认  
**日期：** 2026-07-24  
**范围：** Windows 本地发布、Web E2E、Electron E2E、生产产物验证

## 目标

关闭 `GAP-05`：为 Schedule v2 提供可复现的 Windows x64 NSIS 打包流程，补齐 Web 与 Electron 的端到端覆盖，并证明生产产物不依赖 legacy 源码、开发服务器或未声明的本机环境。

本设计不包含 macOS、Linux、代码签名、安装包上传、自动更新、Tauri、同步、账户体系或 legacy 源码删除。legacy 删除继续由 `GAP-06` 负责。

## 已批准决策

- 发布流程仅要求本地可复现，不新增 GitHub Actions 或其他 CI。
- Windows 目标为 x64 NSIS 安装程序，同时保留 `win-unpacked` 用于生产产物冒烟。
- “通知端口”验证 renderer → preload → IPC → notifier 的安全调用链，不自动断言 Windows 通知横幅。
- 采用混合验证：平台无关用户流程在 Chromium 中运行，宿主能力在 Electron 中运行，打包后另做生产产物冒烟。
- 纯配置改动使用命令级 RED→GREEN；不为 Playwright 或 electron-builder 配置制造无业务价值的单元测试。

## 方案比较

### 方案 A：混合验证

Web E2E 使用 Chromium 和 Vite 生产构建预览；Electron E2E 只验证宿主专属行为；Windows 打包后直接启动 `win-unpacked`。该方案覆盖完整、失败定位清晰，并避免为相同 UI 流程重复启动 Electron。

### 方案 B：全部通过 Electron 验证

该方案更接近桌面运行环境，但会重复大量平台无关 UI 测试，运行时间更长，失败时难以区分 Vue、IPC、数据库或 Electron 生命周期问题。

### 方案 C：全部针对安装产物验证

该方案发布真实性最高，但每轮反馈都需要完整打包，系统环境影响大，不适合作为主要开发反馈环。

采用方案 A。

## 命令与产物

`package.json` 提供以下真实命令：

- `test:e2e:web`：构建 Web，启动本地 Vite preview，运行 `tests/e2e/web`。
- `test:e2e:electron`：重建 Electron 原生模块，构建 Web 和 Electron，运行 `tests/e2e/electron`。
- `package:win`：重建 `better-sqlite3`，构建 v2 Web/Electron，使用 electron-builder 生成 Windows x64 NSIS 产物。
- `test:package:win`：直接启动 `release/win-unpacked/schedule.exe`，验证生产入口、preload 和隔离边界，并检查版本化 NSIS 安装程序存在。
- `release:win`：顺序执行静态检查、核心测试、Web/Electron E2E、Windows 打包和生产产物冒烟。

`release:win` 不上传、不签名、不配置自动更新。产物写入被 Git 忽略的 `release/`：

- `release/win-unpacked/schedule.exe`
- `release/schedule-2.0.0-alpha.0-setup.exe`

安装程序文件名继续由 `package.json` 中的版本和 `electron-builder.yml` 的 `artifactName` 生成。

## Playwright 结构

新增公共 `playwright.config.ts`，保存固定 locale、timezone、viewport、失败截图、首次重试 trace 和失败视频等共享设置。

新增两个独立入口：

- `playwright.web.config.ts`：只为 Web 项目启动 `vite preview`。
- `playwright.electron.config.ts`：不启动 Web server，直接运行 Electron 和打包产物测试。

Web 与 Electron 测试共享固定日期和小型 helper，但不共享可变应用状态。每个测试创建独立浏览器上下文、Electron user data 目录和数据库路径，结束后清理临时目录。

## Web E2E 覆盖

### 日程生命周期

- 新增带确定日期的 Todo。
- 从详情页编辑名称和时间。
- 软删除日程并确认结果。
- 提交无效 `rTime` 并确认用户可见错误。

当前首页没有渲染 schedule mutation error。实现阶段先增加失败的 Web E2E，再只增加必要的错误展示，不重构 modal 或 composable。

### Todo 与日历

- 勾选 Todo 完成并确认状态更新。
- 在相同 fixture 下切换月视图和周视图。
- 确认日程在两个视图中均可见。

### 设置与专注

- 修改时区、周起始日、日历模式和专注时长，并确认页面状态更新。
- 从 Todo 进入专注页。
- 覆盖开始、暂停、恢复和 Focus → Small Break 阶段切换。
- 使用 Playwright 虚拟时钟推进时间，不等待真实分钟数。

Web 测试使用现有 in-memory gateway，不访问 Electron preload、SQLite 或宿主 API。

## Electron E2E 覆盖

### 本地持久化

保留并整理现有测试：使用独立 SQLite 文件创建日程，退出后用相同数据库和 profile 重启，确认数据恢复。

### 窗口安全边界

保留以下断言：

- 普通启动只有一个可见且最大化的主窗口。
- renderer 不暴露 Node `process`。
- preload 只暴露批准的命名 API。
- `--autostart` 启动保持隐藏、不最大化且不聚焦。
- 禁用托盘时关闭窗口会退出进程。

### 托盘

启用托盘后关闭主窗口，确认窗口隐藏且应用进程继续运行；触发应用 activate 后确认窗口恢复、最大化并聚焦。托盘菜单 Show、Quit 和双击与 controller 的精确映射继续由现有 Electron 集成测试覆盖，避免依赖不稳定的 Windows 原生托盘坐标自动化。

### 开机启动设置

测试在 Electron main process 中临时替换 `app.setLoginItemSettings`，从设置页面切换 Open At Login，并断言捕获到预期参数。替换仅存在于该 Electron 测试进程，避免修改真实 Windows 开机启动项。

### 通知端口

测试在 Electron main process 中临时替换 `Notification.prototype.show`，从 renderer 调用 `scheduleHost.showNotification`，确认经过 preload、Zod IPC 合约和 notifier 后得到正确标题与正文。该方式不显示真实系统横幅。

### 安全外链

测试临时替换 `shell.openExternal`：

- HTTPS 链接交给 shell 且不创建 Electron 子窗口。
- `file:` 等未批准协议不调用 shell，也不创建子窗口。

## Windows 打包

将 electron-builder 固定为开发依赖并更新 pnpm lockfile。`electron-builder.yml` 只声明本次批准的 Windows x64 NSIS 目标，移除未批准且未经验证的 macOS、DMG、Linux 和 publish 配置。

打包输入白名单只包含：

- `dist-web/**`
- `dist-electron/**`
- `package.json`
- Electron 运行所需的生产依赖
- `resources/**`

`better-sqlite3` 在打包前使用项目现有 `electron:rebuild-native` 命令针对当前 Electron 版本重建，并继续从 asar 解包。打包配置不包含 `src/main/**`、`src/preload/**`、`src/renderer/**`、Vite 开发服务器或 legacy 数据库。

## 生产产物冒烟

`test:package:win` 直接用 Playwright Electron 启动 `release/win-unpacked/schedule.exe`，使用独立 user data 和数据库目录，并验证：

- 主页面成功显示。
- `webContents.getURL()` 使用 `file:`。
- `window.scheduleHost` 存在且通过 schema 边界。
- renderer 中 `process` 为 `undefined`。
- 应用可正常退出。
- 版本化 NSIS 安装程序文件存在且大小非零。

该测试不安装 NSIS 包，因此不会写入注册表、开始菜单或系统卸载信息；它验证安装程序已生成，并对安装程序包含的 unpacked 应用执行生产启动测试。

## 错误处理与隔离

- Web preview 使用固定端口，由 Playwright 负责启动和停止；端口占用直接导致测试失败，不复用未知本地服务器。
- Electron 测试的 user data、数据库和临时捕获状态互相隔离。
- 对 Electron API 的临时替换只存在于单个测试进程，实例退出后自动清除。
- 测试清理失败不得掩盖原始断言失败。
- Electron GUI 测试和 Windows 产物启动按仓库排障指南在沙箱外运行。
- 打包失败保留 electron-builder 原始退出码，不吞掉依赖、原生模块或 NSIS 错误。

## 文档与 GAP 关闭

新增 Windows 本地发布说明，记录：

- Node.js 24 LTS 与 `packageManager` 固定的 pnpm 版本。
- 安装依赖、验证、打包和完整本地发布命令。
- 产物路径。
- 未签名安装程序的 Windows 提示。
- Electron GUI/E2E 的执行权限边界。
- 本次不支持的平台和发布能力。

只有全部验证实际通过后，才把 `docs/development/v2-feature-gaps.md` 中 `GAP-05` 更新为 `已完成`，并记录实际关闭命令与结果。

## 验证顺序

1. ESLint。
2. Vue 与 Electron TypeScript 检查。
3. unit、contract、parser 测试。
4. Electron integration 与 IPC 测试。
5. Web 和 Electron 构建。
6. Web E2E。
7. Electron E2E。
8. Windows x64 NSIS 打包。
9. `win-unpacked` 生产冒烟和安装程序存在性检查。

任何阶段失败都保持 `GAP-05` 为 `待实施`，并报告真实失败边界。
