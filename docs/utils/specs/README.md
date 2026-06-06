# Utils — 代码风格与约束

本包遵循 [通用代码规范](../extra/common-specs.md)，以下为 utils 特有的补充。

> 本包不对外发布，由消费方 bundler 直接链接 TypeScript 源码（`"main": "./src/index.ts"`）。

## 环境

- Node.js

## 架构模式

### 泛型 Webview 提供者

```typescript
class WebviewProvider<ToWebImpl, ToHostImpl>
  implements vscode.WebviewViewProvider { ... }
```

类型安全的 IPC postMessage 桥，消费 [@mse/types](../types/models/) 的协议类型。

### 自定义 Winston Transport

`VscodeOutputChannelTransport` 继承 `winston-transport` 基类，使用 VS Code 的 `OutputChannel.appendLine()`。

## 外部接口

API 定义在 [src/index.ts](../../../pkgs/utils/src/index.ts)：

- `logger`, `loggerChannel`, `setupLogger()`
- `WebviewProvider`, `WebviewPanelProvider`, `provideWebview()`

详见源码。
