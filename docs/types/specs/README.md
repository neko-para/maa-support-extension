# Types — 代码风格与约束

本包遵循 [通用代码规范](../extra/common-specs.md)，以下为 types 特有的补充。

> 本包不对外发布，由消费方 bundler 直接链接 TypeScript 源码（`"main": "./src/index.ts"`）。

## 环境

- 同时支持 Node.js 和 Browser（被 extension 和 webview 共同消费）

## 架构模式

### 可辨识联合消息

所有消息类型使用 `command` 作为判别键：

```typescript
type ControlWebToHost =
  | { command: 'showSelect'; ... }
  | { command: 'toolkitJump'; ... }
```

### 泛型协议堆叠

```typescript
type HostToWeb<Impl extends ImplType> =
  | Impl
  | { command: '__updateBodyClass'; className: string }
  | { command: '__response'; seq: number; data: unknown; error?: string }
```

`Omit<Impl, 'builtin'>` + `builtin?: never` 防止命令名冲突。

### Request-Response 模式

`seq` 字段匹配请求和响应，实现 RPC-over-postMessage。

## 外部接口

所有类型从 [src/index.ts](../../../pkgs/types/src/index.ts) 重新导出。

详见源码。
