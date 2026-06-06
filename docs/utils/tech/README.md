# Utils — 技术架构

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 模块架构

```
src/
├── index.ts                  # Re-export barrel
├── logger.ts                 # Winston 日志系统
│                             #   - 默认 console transport
│                             #   - setupLogger(channel, file)
│                             #   - VscodeOutputChannelTransport
│                             #   - 自动 rotate > 10MB
└── webview/
    ├── view.ts               # WebviewProvider (侧边栏)
    ├── panel.ts              # WebviewPanelProvider (独立面板)
    ├── data.ts               # CSP meta 标签模板
    ├── forward.html          # Vite HMR postMessage 代理
    ├── html.d.ts             # .html 导入声明
    └── forward.d.html.ts     # forward.html 导入声明
```

## Dev Mode 架构

```
┌────────────────────────────────────────────────┐
│  VS Code Webview                               │
│  ┌──────────────────────────────────────────┐  │
│  │  forward.html                            │  │
│  │  ┌────────────────────────────────────┐  │  │
│  │  │  iframe → Vite Dev Server          │  │  │
│  │  │  http://localhost:5173/control     │  │  │
│  │  │  (Vue App with HMR)                │  │  │
│  │  └────────────────────────────────────┘  │  │
│  │  ↕ postMessage                          │  │
│  │  acquireVsCodeApi().postMessage()        │  │
│  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

## 依赖关系

### 工作区依赖

| 包 | 角色 |
|---|---|
| `@mse/types` | IPC 协议类型 |

### 外部依赖

| 包 | 用途 |
|---|---|
| `winston` | 结构化日志框架 |
| `winston-transport` | 自定义 transport 基类 |
| `triple-beam` | winston 日志级别符号 |

## 技术选型

| 选择 | 理由 |
|---|---|
| `winston` | Node.js 最成熟的日志框架，支持多 transport |
| 无构建步骤 | 不对外发布，由消费方 bundler 直接链接 TypeScript 源码 |
| `forward.html` 代理 | 实现 Vite HMR 在 VS Code webview 沙箱中工作 |
| MutationObserver | 实时同步 VS Code 主题到 iframe（CSS 变量、body class） |
| 10MB 日志 rotate | 简单粗暴的文件删除重建，避免依赖复杂日志轮转库 |
