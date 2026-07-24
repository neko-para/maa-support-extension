# Webview — 代码风格与约束

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用代码规范](../extra/common-specs.md)，以下为 webview 特有的补充。

## 环境

- Browser（VS Code Webview sandbox）

## Vue 规范

- **Vue 3 Composition API** + `<script setup>` 语法
- **组件名**: PascalCase 多词 — `TaskCard`、`AppTooltip`、`JsonCode`
- **Composable**: `use*` 前缀 — `useIpc()`、`useTheme()`
- **目录**: 路由/view 组件放在 `views/`，UI 组件放在 `components/`
- **ESLint**: `eslint-plugin-vue` (`flat/essential`) + `vue/no-mutating-props` (`shallowOnly: true`)
- 响应式状态通过 `ref()` 和 `reactive()` 管理，无 Vue Router（三应用完全独立）

## CSS 命名

- 使用 VS Code CSS 变量（`--vscode-*`）
- 通过 Naive UI 的 `n-config-provider` 统一主题

## 架构模式

### IPC Composable

```typescript
const { send, call, recv } = useIpc<HostToWeb, WebToHost>()
```

- `send(message)` — fire-and-forget
- `call(message)` — 返回 Promise，通过 `seq` + `Map<number, resolve>` 匹配响应
- `recv(callback)` — 注册消息处理器

### Dev/Prod 抽象

Dev 模式下 `acquireVsCodeApi` 不存在，回退到 `window.parent.postMessage()`。

### 主题观察

```typescript
const observer = new MutationObserver(() => updateTheme())
observer.observe(document.documentElement, { attributes: true })
observer.observe(document.body, { attributes: true })
```

## 外部接口

三个应用各自通过 `@mse/types` 的协议类型与 host 通信。

详见源码目录：

- [src/control/](../../../pkgs/webview/src/control/)
- [src/crop/](../../../pkgs/webview/src/crop/)
- [src/launch/](../../../pkgs/webview/src/launch/)
- [src/utils/](../../../pkgs/webview/src/utils/)
