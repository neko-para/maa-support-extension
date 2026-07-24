# Maa Tools — 代码风格与约束

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用代码规范](../extra/common-specs.md)，以下为 tools 特有的补充。

## 环境

- Node.js（CLI 运行环境）

## 架构模式

### 三态输出模式

```typescript
type OutputMode = 'stdio' | 'github' | 'json'
```

所有操作支持统一的输出模式切换。

### 错误传播

`runCheck()` 和 `runTest()` 返回 `Promise<boolean>`：

- `true` — 成功
- `false` — 发现错误

CLI 将其映射为进程退出码。

### 配置类型

使用交集类型组合配置：

```typescript
type FullConfig = BaseConfig & { check?: CheckConfig; test?: TestConfig; vscode?: VscodeConfig }
```

## 外部接口

### CLI

- `npx @nekosu/maa-tools init`
- `npx @nekosu/maa-tools check [config-path]`
- `npx @nekosu/maa-tools test [config-path]`

### 库 API

API 定义在 [src/index.ts](../../../pkgs/maa-tools/src/index.ts) 和 [src/pm.ts](../../../pkgs/maa-tools/src/pm.ts)（`./pm` 子路径）。

详见源码。
