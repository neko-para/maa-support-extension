# Webview — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 包标识

- **npm 包名**: `@mse/webview`
- **类型**: VSCode 插件 Webview 前端（Vue 3）

## 目标用户

- `@mse/extension` — 插件 host 端创建和管理 webview 实例
- 终端用户 — 通过 VSCode 界面交互

## 三个独立应用

### 1. Control Panel（控制面板）

侧边栏常驻面板，提供类 MaaPiCli 的控制界面：

- **Controller 配置**: ADB/Win32/PlayCover/Gamepad 的参数设置
- **Resource 选择**: 切换活动的 resource bundle
- **Task 管理**: 添加/删除/配置任务选项
- **Launch**: 启动任务执行
- **Eval**: MAA 表达式求值
- **Toolkit**: 快捷工具跳转，以及管理员模式、调试模式、识别绘图落盘开关和全局快捷键目标激活；调试模式决定运行详情能否查询每次识别使用的 Raw 原图；识别绘图开关仅将带标注的 Draw 图保存到磁盘，并提示可能产生大量文件

控制面板按 Toolkit → Interface → Controller → Resource → Task → Launch/Eval 的顺序展示；先选择 Controller，再选择受其约束的 Resource。

> **已知性能问题**: 全量同步 State 时，interface 对象可能过大，导致 Vue 响应式对象重建延迟严重。针对高频率修改（如 text input），实现了临时性的 debounce 策略来缓解。预期改进方向：将 interface 文件隔离出主 state；或使用更精确的状态同步方案。但目前 state 由 utils 模块提供的固定能力管理，且 interface 对象是从文件全量 parse 而来，无法通过文件编辑信息增量优化。

### 2. Crop Tool（裁剪工具）

按需创建的独立面板：

- **截图**: 通过 MaaFramework 获取屏幕截图
- **裁剪**: 基于 Canvas 的图像裁剪
- **OCR**: 在图像上执行文字识别
- **模板匹配**: 使用自定义模板进行图像匹配
- **识别测试**: 运行 pipeline 识别测试
- **可视化设置**: ROI 编辑、绿色蒙版、颜色阈值；识别详情为空时跳过绘制
- **主题适配**: Canvas 背景始终跟随 VS Code 编辑器背景色，并使用主题边框界定可交互区域；不提供独立背景色配置

### 3. Launch Panel（启动面板）

任务执行时的实时监控面板：

- **状态显示**: 当前任务节点、暂停/运行状态
- **控制栏**: 暂停/继续/停止按钮
- **断点管理**: 设置和管理任务断点
- **Analyzer 集成**: 通过 iframe 对接 [MaaLogAnalyzer](https://github.com/MaaXYZ/MaaLogAnalyzer)（JSON-RPC 2.0）
- **实时事件流**: 识别/动作事件的实时推送
- **详情查询**: 识别和动作详情（含缓存图像）

## 共享能力

### IPC 通信

`useIpc<ToWeb, ToHost>()` 泛型 composable：

- `send()` — 单向发送
- `call()` — request-response（通过 `seq` 匹配）
- `recv()` — 消息接收回调

自动检测 dev/prod 模式，选择 `acquireVsCodeApi()` 或 `window.parent.postMessage()`。

### 主题集成

`useTheme()` composable：

- 读取 VS Code CSS 自定义属性（`--vscode-*`）
- 动态构建 Naive UI 主题覆盖
- `MutationObserver` 监听主题变化
- 将解析后的编辑器背景色暴露为响应式状态，供 Crop Canvas 跟随主题重绘

### 国际化

Webview 独立的 locale 系统（复制了 `@nekosu/maa-locale` 的 `t()` / `CountBrace` 模式）：

- `locale.zh-cn.ts` — 简体中文字典
- `locale.en.ts` — 英文字典
- 响应式 locale 切换（`vscodeLocale` ref）

> 这是历史遗留问题。参见 [extra/locale-system.md](../extra/locale-system.md)。

## 抽象边界

- 所有 Webview 代码在浏览器沙箱中运行
- 不直接访问 Node.js API
- 通过 `@nekosu/maa-types` 的类型协议与 host 通信
- 使用 `Buffer` polyfill 兼容引用的节点类型
