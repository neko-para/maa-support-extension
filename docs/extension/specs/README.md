# Extension — 代码风格与约束

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用代码规范](../extra/common-specs.md)，以下为 extension 特有的补充。

## 环境

- Node.js（`globals.node`）

## 命名约定

### VSCode 命令命名

现有命令 ID 属于兼容性 API，可能被用户快捷键、菜单及其他扩展直接引用。不得仅为统一命名而修改或删除；确需迁移时必须保留旧 ID 作为兼容别名，并记录弃用周期。

新增命令遵循以下规则：

- 所有分段使用 kebab-case，并统一声明在 `src/command.ts`
- 通用、用户可直接调用的命令使用 `maa.<action>`
- 有明确领域归属的公开命令使用 `maa.<domain>.<action>`，领域名应表达稳定能力，避免新增含义不明确的 `maa.pi.*`
- 仅供插件内部的命令使用 `maa.private.<action>`，不作为外部 API 文档化

历史命名空间 `maa.pi.*`、`maa.native.*`、`maa.debug.*` 等继续保留，以兼容已发布版本。

### 两个并行体系

区分两个语言域使用不同前缀：

- `Interface*` — 针对 `interface.json` 的处理（`InterfaceDefinitionProvider`、`InterfaceHoverProvider`）
- `Pipeline*` — 针对 pipeline 文件的处理（`PipelineDefinitionProvider`、`PipelineHoverProvider`）

## 架构模式

### 服务模式

- 所有服务继承自 `BaseService` → `DisposableHelper`
- `service/index.ts` 是唯一 composition root，统一构造全部核心服务、注册后再执行初始化
- 服务单例的 live bindings 位于 `service/registry.ts`；该模块对实现类只能使用 `import type`
- 服务实现和 Provider 只能从 registry 获取其他服务，不得导入 `service/index.ts`
- 服务通过 `constructor()` 同步初始化 + `async init()` 异步初始化
- 不使用第三方依赖注入容器；类型化 registry 负责 extension 单实例生命周期内的服务定位
- 使用 `vscode.EventEmitter` 进行跨服务通信

### DisposableHelper.defer 模式

```typescript
this.defer = someDisposable
```

自动注册 disposable 对象，在插件 deactivate 时统一释放。

### FlushHelper 模式

用于 debounce 批量处理（如诊断扫描）。新 flush 请求在活动 flush 期间被排队，完成后重新执行。

### Webview Provider

Host 侧 Webview 基类位于 `src/utils/webview/`，使用 `@nekosu/maa-types` 的泛型协议约束消息方向。侧边栏使用 `WebviewProvider`，独立面板使用 `WebviewPanelProvider`；开发模式统一通过 `forward.html` 连接 Vite dev server。

### 日志

扩展内所有模块复用 `src/utils/logger.ts` 导出的 `logger`。VS Code OutputChannel 和文件 transport 仅在 `activate()` 中通过 `setupLogger()` 初始化一次；需要直接展示输出频道的服务使用同一模块导出的 `loggerChannel`。

## 外部接口

本包的主要外部接口为 [VSCode Extension API](https://code.visualstudio.com/api) 的 `activate()` / `deactivate()` 生命周期钩子，以及通过 `package.json` 的 `contributes` 字段注册的命令、视图、语言特性。

详见源码：

- 入口: [src/extension.ts](../../../pkgs/extension/src/extension.ts)
- 服务注册: [src/service/index.ts](../../../pkgs/extension/src/service/index.ts)
- 命令注册: [src/service/command.ts](../../../pkgs/extension/src/service/command.ts)
