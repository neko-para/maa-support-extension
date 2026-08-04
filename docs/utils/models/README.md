# Utils — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 包标识

- **npm 包名**: `@mse/utils`
- **类型**: 插件通用工具库
- **说明**: 历史遗留问题，功能归属不够清晰

## 目标用户

- `@mse/extension` — 主要消费方

## 核心能力

### 1. 结构化日志

基于 winston 的日志系统：

- Console transport（`silly` 级别，默认）
- VS Code OutputChannel transport（级别通过 `maa.outputLevel` 配置）
- File transport（`debug` 级别，自动 rotate > 10MB）
- 自定义 `VscodeOutputChannelTransport` 适配器

### 2. Webview 提供者

两个可复用的 webview 管理类：

- `WebviewProvider` — 侧边栏 webview（`vscode.WebviewViewProvider`）
- `WebviewPanelProvider` — 独立面板 webview（`vscode.WebviewPanel`）

两者均：

- 支持开发模式（Vite HMR via `forward.html` iframe 代理）
- 支持生产模式（静态 HTML 加载）
- 泛型参数支持 `@nekosu/maa-types` 的 IPC 类型

### 3. 开发模式代理

`forward.html` 是 Vite HMR 到 VS Code webview 的 postMessage 桥：

- VS Code webview ↔ iframe ↔ Vite dev server
- 自动同步 VS Code 主题（body class、HTML style）到 iframe
- 双向 postMessage 转发

## 抽象边界

本包是历史遗留产物。核心功能（webview 提供者、日志）可能更适合归属到 `extension` 包中。
