# Extension — 代码风格与约束

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用代码规范](../extra/common-specs.md)，以下为 extension 特有的补充。

## 环境

- Node.js（`globals.node`）

## 命名约定

### VSCode 命令命名

命令使用命名空间前缀（`maa.*`、`maa.pi.*`、`maa.native.*`、`maa.debug.*`、`maa.private.*`）。

> **历史遗留问题**: 命令命名未经过统一设计，缺乏一致的层级结构。

### 两个并行体系

区分两个语言域使用不同前缀：

- `Interface*` — 针对 `interface.json` 的处理（`InterfaceDefinitionProvider`、`InterfaceHoverProvider`）
- `Pipeline*` — 针对 pipeline 文件的处理（`PipelineDefinitionProvider`、`PipelineHoverProvider`）

## 架构模式

### 服务模式

- 所有服务继承自 `BaseService` → `DisposableHelper`
- 服务实例化为模块级单例（`let` 变量），在 `service/index.ts` 中统一创建
- 服务通过 `constructor()` 同步初始化 + `async init()` 异步初始化
- 无依赖注入容器，服务间通过模块级变量直接互相引用
- 使用 `vscode.EventEmitter` 进行跨服务通信

### DisposableHelper.defer 模式

```typescript
this.defer = someDisposable
```

自动注册 disposable 对象，在插件 deactivate 时统一释放。

### FlushHelper 模式

用于 debounce 批量处理（如诊断扫描）。新 flush 请求在活动 flush 期间被排队，完成后重新执行。

## 外部接口

本包的主要外部接口为 [VSCode Extension API](https://code.visualstudio.com/api) 的 `activate()` / `deactivate()` 生命周期钩子，以及通过 `package.json` 的 `contributes` 字段注册的命令、视图、语言特性。

详见源码：
- 入口: [src/extension.ts](../../../pkgs/extension/src/extension.ts)
- 服务注册: [src/service/index.ts](../../../pkgs/extension/src/service/index.ts)
- 命令注册: [src/service/command.ts](../../../pkgs/extension/src/service/command.ts)
