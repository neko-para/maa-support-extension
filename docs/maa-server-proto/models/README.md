# Maa Server Proto — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 包标识

- **npm 包名**: `@mse/maa-server-proto`
- **类型**: 通信协议定义库

## 目标用户

- `@mse/extension` — 插件端使用此协议与 server 通信
- `@mse/maa-server` — server 端实现此协议

## 核心能力

### 1. RPC Channel 定义

定义 JSON-RPC 通信 channel 常量：

| Channel | 方向 | 说明 |
|---|---|---|
| `initNoti` | Server → Host | 连接时发送 client ID |
| `logNoti` | Server → Host | 日志转发 |
| `shutdownNoti` | Server → Host | 关闭信号 |
| `hostToSubReq` | Host → Server | 双向请求 channel |
| `subToHostReq` | Server → Host | 双向请求 channel |

### 2. API 类型定义

定义完整的双向协议类型：

**Host → Server** (约 18 个方法)：
- `fetchConstants()`、`updateController()`、`setupInstance()`
- `getScreencap()`、`resize()`
- `performOcr()`、`performTemplateMatch()`、`performReco()`
- `refreshAdb()`、`refreshDesktop()`
- `postTask()`、`postStop()`、`getKnownTasks()`、`destroyInstance()`
- `getRecoDetail()`、`getActDetail()`、`getNode()`
- `agentStopped()`

**Server → Host** (约 4 个方法)：
- `pushNotify()`、`startTask()`、`startDebugSession()`、`stopAgent()`、`quickPick()`

### 3. 工具类型

- `MarkReturnPromise<T>` — 将函数返回值包装为 `Promise<... | null>`
- `MarkApisImpl<T>` — 应用于所有 API 键
- `MarkApis<Server, Client>` — 组合双向 API 类型，包含 `$` 处理器注册属性

## 抽象边界

本包是纯类型定义库。`declares.ts` 中的 RPC channel 常量为唯一运行时导出。
