# Windows 本地发布

## 支持范围

Schedule v2 当前只验证 Windows x64 NSIS。本流程不包含签名、上传、自动更新、macOS 或 Linux。

## 环境

- Node.js 24 LTS
- `package.json#packageManager` 固定的 pnpm 11.17.0
- Windows 桌面会话；Electron E2E 和产物冒烟必须允许启动 GUI 子进程
- 若使用本机代理，确保 `HTTP_PROXY` 与 `HTTPS_PROXY` 指向可用的 HTTP 代理

## 安装依赖

```powershell
corepack enable
pnpm install --frozen-lockfile
```

## 完整本地发布

```powershell
pnpm release:win
```

## 单独打包与验证

```powershell
pnpm package:win
pnpm test:package:win
```

产物位于 `release/win-unpacked/` 和
`release/schedule-<version>-setup.exe`。安装程序未签名，Windows 可能显示
SmartScreen 提示。生产应用从打包的 `dist-web` 加载，不需要 Vite 开发服务器。
