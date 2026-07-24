# Maa Server Proto — 代码风格与约束

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用代码规范](../extra/common-specs.md)，以下为 proto 特有的补充。

## 环境

- Node.js

## 命名约定

- 函数: camelCase — `fetchConstants()`、`updateController()`、`pushNotify()`
- 类型: PascalCase — `HostToSubApis`、`SubToHostApis`
- 缩写: `Noti` = Notification、`Req` = Request、`Apis` = APIs
- `Mark*` 前缀 — 工具类型: `MarkReturnPromise`、`MarkApisImpl`、`MarkApis`

## 架构模式

### 双向协议类型

```typescript
interface HostToSubApis { ... }  // Host 可调用的 Server 方法
interface SubToHostApis { ... }  // Server 可调用的 Host 方法
```

### $ 处理器注册

```typescript
type MarkApis<Server, Client> = ServerApis &
  ClientApis & {
    $: MarkApisImpl<Server> // 本地处理器注册
  }
```

### Promise 包装

所有远程调用返回值包装为 `Promise<... | null>`，失败时返回 `null`。

## 外部接口

协议定义在 [src/apis.ts](../../../pkgs/maa-server-proto/src/apis.ts) 和 [src/declares.ts](../../../pkgs/maa-server-proto/src/declares.ts)。

详见源码。
