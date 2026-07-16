# Electron E2E 排障指南

## 适用症状

当 Playwright Electron 测试出现以下一组现象时，先按本文检查执行环境：

- Electron GPU 子进程反复退出；
- stderr 包含 `GPU process exited unexpectedly`；
- 本地 `file:///.../dist-web/index.html` 加载返回 `ERR_FAILED`；
- `BrowserWindow.webContents.getURL()` 为空且 `isLoading()` 为 `false`；
- Windows 退出码为 `0xC0000135`（十进制 `-1073741515`）；
- 页面断言超时，但 main process 已创建 BrowserWindow。

这些症状不能单独证明产品代码、Electron 包或系统 DLL 有问题。`0xC0000135` 常与缺少依赖相关，但必须先在沙箱外复现，才能把依赖缺失列为本次故障的根因。

## 首要规则

Electron E2E 会启动 GUI 和子进程，必须在沙箱外执行，并取得所需批准。不要先向生产入口添加 `--disable-gpu`、`app.disableHardwareAcceleration()`、测试专用环境变量或重试逻辑。

项目的聚焦启动命令是：

```powershell
.\node_modules\.bin\playwright.cmd test tests/e2e/electron/startup.spec.ts
```

在受限代理环境中，该命令应通过沙箱外执行权限运行；不要把权限要求编码进项目脚本。

## 诊断顺序

1. 先构建 Web、Electron main 和 preload，确认构建本身退出 `0`：

   ```powershell
   .\node_modules\.bin\vite.cmd build
   .\node_modules\.bin\vite.cmd build --config vite.electron-main.config.ts
   .\node_modules\.bin\vite.cmd build --config vite.electron-preload.config.ts
   ```

2. 捕获 Electron 子进程 stderr，记录第一条加载失败或子进程退出信息，不要只看最终 Playwright timeout。
3. 从 main process 读取以下状态，区分“窗口策略错误”和“页面根本没有加载”：
   - `BrowserWindow.isVisible()`；
   - `BrowserWindow.isMaximized()`；
   - `BrowserWindow.webContents.isLoading()`；
   - `BrowserWindow.webContents.getURL()`。
4. 不改源码、不加 Chromium 开关，使用同一构建产物在沙箱外重跑同一条 Electron E2E 命令。
5. 如果沙箱外通过，结论是执行环境阻止了 GUI/子进程；撤掉所有诊断性产品改动。
6. 只有沙箱外仍以相同方式失败，才继续检查 Electron distribution 文件、Visual C++ 运行库、原生模块重建、系统策略或产品启动代码。

## 本项目已验证案例

Schedule 的启动 E2E 曾在沙箱内出现 GPU 子进程以 `0xC0000135` 退出、主窗口 URL 为空和 `ERR_FAILED`。以下尝试均未解决沙箱内运行：

- Electron CLI `--disable-gpu`；
- 在 `app.ready` 前调用 `app.disableHardwareAcceleration()`。

撤掉上述实验后，同一最终构建在沙箱外运行，普通启动、`--autostart` 后台启动和安全 `window.open` 三项测试全部通过。因此本案例的正确第一结论是执行权限边界，而不是已证实缺少 DLL。

## 禁止的捷径

- 不根据 `0xC0000135` 单独断言“Windows 缺少运行依赖”。
- 不把测试环境 workaround 永久加入 production composition root。
- 不用多个 GPU/Chromium 开关进行无证据的排列组合。
- 不因页面断言超时就直接修改窗口显示逻辑；先检查 URL 和 loading 状态。
- 不在沙箱内重复运行 GUI 测试并把相同失败计为新的产品证据。

## 预期成功证据

成功的聚焦验证应显示：

- 普通启动窗口可见并最大化；
- `--autostart` 窗口隐藏、未最大化且未聚焦；
- 不安全的 `window.open` 不创建 Electron 子窗口；
- Playwright 汇总为 `3 passed`。
