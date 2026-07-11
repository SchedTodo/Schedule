# Schedule v2 旧版 UI 忠实移植设计

## 目标

以 `release/1.2.0` 仍保留在 `src/renderer/src` 的界面和交互为唯一视觉基准，替换当前偏离旧版的 v2 UI。保留 v2 的浏览器可运行架构、`PlatformGateway` 边界、本地持久化、严格类型和主题偏好。

## 设计取舍

采用“忠实移植而非直接复制”。DOM 结构、页面比例、导航位置、英文文案、卡片层级、按钮与快捷键尽量匹配旧版；数据读取与异步状态改用 v2 composables。禁止把旧版 Axios、EventBus、Prisma、Luxon、用户登录或 Electron 类型复制进 `src`。

## 应用外壳

- 顶部使用旧版深色横向导航：Home、Database、Settings、Help，右侧保留 Guest 头像语义。
- 主内容位于顶部导航和底部 `© 2023` 页脚之间。
- 支持 `Ctrl+ArrowLeft/Right` 按导航顺序切页。
- 右上区域保留旧版黄色 Idea 灯泡，弹出本地持久化 textarea。
- 当前主题模式继续由 `usePreferencesStore` 控制；深色模式只改变颜色令牌，不改变旧版布局。

## 首页

- 左侧约 30vw 为 Todo 列表，保留 Not Expired、Not Done 工具按钮、Name/Deadline/Action/Done 列视觉。
- 右侧工具栏依次为 month/week 切换、Add、同步图标占位；主区域为月视图或五日周视图。
- 月视图用 Naive UI Calendar，并把可识别日期的 event 放进日期格；无法解析为具体日期的 event 放入未排期区，不伪造 occurrence。
- 周视图保持旧版五列时间网格和 event card 视觉；基于 recurrenceCode 中第一个 ISO/斜杠日期与时间进行展示。
- Add 打开旧版风格 modal，字段为 Name、rTime、exTime、Comment；`Ctrl+ArrowUp` 打开、`Ctrl+ArrowDown` 关闭、`Ctrl+Enter` 提交。
- 创建、筛选、详情跳转均调用当前 v2 gateway/composables。

## Database 与详情

- Database 恢复旧版 Card、顶部筛选条和数据表，支持搜索、类型和星标筛选；点击行进入详情。
- 详情恢复 PageHeader、Info Card、Times Card 的层级。Info 显示 Name、Type、Comment、rTime、exTime、Star、Created、Updated；当前 DTO 不含 occurrence/record 时，Times 显示空态，不制造数据。
- Star/Edit/Delete 等尚未出现在 `ScheduleGateway` 的写操作不伪装为成功；本轮保留其视觉位置但用明确禁用态表达 v2 尚未提供。

## Settings 与 Help

- Settings 使用旧版纵向分组 Card 和固定宽 label，保留 Preferences 语义，并新增 Appearance 分组承载主题、紧凑密度。
- Calendar Mode 和 Week Start 继续持久化；主题支持 System、Light、Dark。
- Help 保留旧版简单页面，但列出快捷键，确保入口有实际用途。

## 测试

- 组件测试锁定旧版关键结构：顶部导航、底部、Todo sider、month/week、Add modal 字段与快捷键、Database 表、详情 Info/Times、设置分组和主题。
- composable/contract 测试继续覆盖真实数据行为。
- 完整运行 lint、typecheck、unit/contracts/parser、Web build、Electron build；Electron E2E 更新为通过 Add modal 创建并在重启后从旧版首页视图恢复。

## 范围边界

本轮不恢复用户登录、同步、alarm、tray、专注记录、occurrence 拖拽和完成状态持久化，因为 v2 当前没有对应 gateway 与 DTO。入口若保留，只能是诚实的禁用/空态，不得复制旧后端耦合或伪造成功。
