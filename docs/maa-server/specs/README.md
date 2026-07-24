# Maa Server — 代码风格与约束

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用代码规范](../extra/common-specs.md)，以下为 server 特有的补充。

## 环境

- Node.js

## 架构模式

### Proxy 模式 IPC

使用 JavaScript `Proxy` 创建类型安全的双向 RPC：

- 属性读取 → 发出 `subToHostReq` 远程调用
- 属性写入 → 注册本地 `hostToSubReq` 处理器
- `ipc.$` 持有实际的处理器映射

### makePromise 延迟模式

```typescript
const { promise, resolve, reject } = makePromise<Type>()
```

用于一次性 race/latch 场景（如等待 agent 连接 vs agent 停止）。

### Throwaway Instance 模式

工具函数（OCR、模板匹配、识别测试）创建临时 MaaFramework 实例，用完即销毁。

## 外部接口

本包不暴露 API 给其他包。它的"接口"是 JSON-RPC 协议，定义在 [@mse/maa-server-proto](../maa-server-proto/models/)。

详见源码：

- 入口: [src/index.ts](../../../pkgs/maa-server/src/index.ts)
- IPC 代理: [src/apis.ts](../../../pkgs/maa-server/src/apis.ts)
- MAA 核心: [src/maa.ts](../../../pkgs/maa-server/src/maa.ts)
