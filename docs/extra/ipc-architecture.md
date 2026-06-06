# IPC 通信架构

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 概述

本 monorepo 涉及三种 IPC 通信通道，分别在两个层级运行。

## 通道一览

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  VSCode 插件进程                                                              │
│                                                                              │
│  ┌──────────┐    postMessage     ┌──────────────────┐                        │
│  │ extension │◄─────────────────►│    webview        │                        │
│  │  (Host)   │  @mse/types        │  (Vue App)       │                        │
│  └─────┬─────┘                    └──────────────────┘                        │
│        │                                                                      │
│        ├──────────────────────────────────────────┐                           │
│        │ TCP JSON-RPC (vscode-jsonrpc)             │ child_process.spawn       │
│        │ @mse/maa-server-proto                     │ (PI_* 环境变量)            │
│        │                                          │                            │
│  ┌─────▼─────┐                              ┌─────▼──────────┐                │
│  │ maa-server│  (独立进程, 可提权)             │  Agent 子进程    │                │
│  │ (Sub)     │                              │  (maa-launch /   │                │
│  │           │                              │   debug session) │                │
│  └───────────┘                              └────────────────┘                │
│                                                                              │
│  Server 通过 subToHostReq (startTask/startDebugSession) 回调 extension,       │
│  由 extension 启动和管理 Agent 子进程。Server 反向依赖 extension。              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Channel 1: Extension ↔ Webview (postMessage)

### 协议定义: [@mse/types](../types/models/)

- **传输层**: VS Code Webview postMessage API
- **消息格式**: JSON 对象，`command` 字段判别
- **Request-Response**: 使用 `seq` 字段匹配请求和响应
- **Dev Mode**: 通过 `forward.html` iframe 代理到 Vite dev server

### 三个独立的协议：

| Panel | 消息类型 |
|---|---|
| Control | [ControlHostToWeb / ControlWebToHost](../types/tech/#协议流) |
| Crop | [CropHostToWeb / CropWebToHost](../types/tech/#协议流) |
| Launch | [LaunchHostToWeb / LaunchWebToHost](../types/tech/#协议流) |

## Channel 2: Extension ↔ Maa Server (TCP JSON-RPC)

### 协议定义: [@mse/maa-server-proto](../maa-server-proto/models/)

- **传输层**: TCP socket (`127.0.0.1:{port}`)
- **RPC 框架**: `vscode-jsonrpc`
- **协议类型**: JSON-RPC 2.0 (request/response/notification)

### RPC Channel 常量

| Channel | 类型 | 方向 | 说明 |
|---|---|---|---|
| `initNoti` | Notification | Server → Host | 连接握手（含 client ID） |
| `logNoti` | Notification | Server → Host | 日志转发 |
| `shutdownNoti` | Notification | Server → Host | 关闭信号 |
| `hostToSubReq` | Request | Host → Server | Host 调用 Server 方法 |
| `subToHostReq` | Request | Server → Host | Server 调用 Host 方法 |

### Proxy 模式

`@mse/extension` 和 `@mse/maa-server` 均使用 JavaScript `Proxy` 实现类型安全的 IPC：

```typescript
// Host 端
ipc.updateController(runtime)  // 自动转换为 hostToSubReq JSON-RPC 调用
ipc.$ = { pushNotify: handler } // 注册 subToHostReq 处理器

// Server 端
ipc.quickPick(items)            // 自动转换为 subToHostReq JSON-RPC 调用
ipc.$ = { postTask: handler }   // 注册 hostToSubReq 处理器
```

## Channel 3: Extension → Agent (子进程)

- **触发方式**: Server 通过 `subToHostReq`（`startTask` / `startDebugSession`）回调 extension
- **传输层**: extension 通过 `child_process.spawn` 启动
- **协议**: 环境变量 `PI_*` + stdio/stdout
- **调试模式**: VSCode Debug Adapter Protocol (`maa-launch` type)
- **管理方**: extension 全权管理 agent 生命周期

## 设计理由

| 设计 | 理由 |
|---|---|
| TCP 而非 stdio | Server 可能提权运行（UAC），stdio 管道会断开 |
| `vscode-jsonrpc` | VSCode 生态标准，支持 JSON-RPC 2.0 全部特性 |
| Proxy 模式 | 消除样板代码，编译期类型安全 |
| postMessage 协议 | VS Code webview 唯一支持的通信方式 |
| `forward.html` 代理 | 实现 Vite HMR 在 webview 沙箱中工作 |
