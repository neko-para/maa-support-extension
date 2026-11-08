# Maa Server Proto — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 包标识

- **npm 包名**: `@nekosu/maa-server-proto`
- **类型**: 通信协议定义库

## 目标用户

- `@mse/extension` — 插件端使用此协议与 server 通信
- `@nekosu/maa-server` — server 端实现此协议

## 核心能力

### 1. RPC Channel 定义

定义 JSON-RPC 通信 channel 常量：

| Channel        | 方向          | 说明                 |
| -------------- | ------------- | -------------------- |
| `initNoti`     | Server → Host | 连接时发送 client ID |
| `logNoti`      | Server → Host | 日志转发             |
| `shutdownNoti` | Server → Host | 关闭信号             |
| `hostToSubReq` | Host → Server | 双向请求 channel     |
| `subToHostReq` | Server → Host | 双向请求 channel     |

### 2. API 类型定义

定义完整的双向协议类型：

**Host → Server** (约 22 个方法)：

- `fetchConstants()`、`updateController()`、`setupInstance()`
- `getScreencap(instance?)`、`resize()`
- `performOcr()`、`performTemplateMatch()`、`performColorMatch()`
- `performReco(image, resources, agent?, roi?)`：`agent` 为 `ToolAgentSetup`（项目根目录、相对资源目录、interface agent 声明、连接超时），非空时按需启动 Custom 识别所需的 agent；可选 `roi` 作为 pipeline_override 覆盖节点的 `roi` 字段（画布选区试跑）；返回 `ToolResult`（`detail` + 结构化 `failure`），用户取消节点选择时返回 `null`
- `releaseRecoSession()`：释放 `performReco` 缓存的 agent 资源会话（识别进行中会推迟到本次识别结束后释放）
- `refreshAdb(adbPath?)`、`refreshDesktop()`、`refreshGamescope()`、`refreshWlrCompositor()`
- `postTask()`、`postStop()`、`getKnownTasks()`、`destroyInstance()`
- `getRecoDetail()`、`getActDetail()`、`getNode()`
- `agentStopped()`

**Server → Host** (约 4 个方法)：

- `pushNotify()`、`startTask()`、`startDebugSession()`、`stopAgent()`、`quickPick()`

### 3. 工具类型

- `MarkReturnPromise<T>` — 将函数返回值包装为 `Promise<... | null>`
- `ToolFailure` / `ToolResult` — 一次性识别工具的结构化失败原因（缺 agent、识别名未注册、agent 启动失败/中途退出、正式实例占用同名 identifier（`agent-in-use`）、忙碌、内部错误）与返回结果；文案由宿主本地化。内部错误使用 `ToolInternalTag` 固定标签（`no-resource` / `ipc` / `resource-load-failed` / `controller-create-failed` / `tasker-create-failed` / `scan-failed` / `invalid-options` / `custom-recognition-failed` / `internal-error`）而不是裸文本，宿主映射表由 `Record<ToolInternalTag, ...>` 保证新增标签时类型检查失败
- `ToolAgentSetup` — 一次性识别工具启动 agent 所需的上下文
- `ColorMatchOptions`（来自 `@nekosu/maa-types`）— 快速匹配 ColorMatch 的参数
- `MarkApisImpl<T>` — 应用于所有 API 键
- `MarkApis<Server, Client>` — 组合双向 API 类型，包含 `$` 处理器注册属性

## 抽象边界

本包是纯类型定义库。`declares.ts` 中的 RPC channel 常量为唯一运行时导出。
