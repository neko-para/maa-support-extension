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

### Test Worker 隔离键

识别测试的 worker pool 必须按解析后的完整有序资源路径列表隔离，使用数组的结构化序列化作为内部键。不得拼接 controller/resource 名称作为缓存键，因为名称组合可能碰撞，也无法识别路径等价的不同配置。执行计划可按资源组重排，但结果槽位和最终报告必须保持稳定的 controller/resource 顺序。

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

### JSON 接口兼容

收集清单、运行报告、三类进度事件及最终 `run-result`（包括参数、配置和执行错误路径）随 maa-tools 包版本管理兼容性，逐行记录保留 `type`。配套插件只接受稳定版 `>=1.2.0 <2.0.0`；允许 `v` 前缀和构建元数据，预发布、未知或格式无效的版本均不接受。新主版本须由插件明确支持后才接收。

1.x 内新增旧插件可忽略的可选字段可以兼容。以下变化须发布新主版本：

- 改名、删除必需字段或改变字段类型。
- 改变通过、失败、错误、跳过或空运行等结论语义。
- 增加旧插件必须处理的新记录 `type` 或枚举值。

调用方先检查包版本范围，仍须校验实际启动与数据的必需结构、合法 `type`、来源、选择覆盖和进度与最终结果一致性；类型声明不能代替运行时校验。字段和事件说明见[产品定义](../models/README.md#包版本与-json-兼容)。

### 库 API

API 定义在 [src/index.ts](../../../pkgs/maa-tools/src/index.ts) 和 [src/pm.ts](../../../pkgs/maa-tools/src/pm.ts)（`./pm` 子路径）。

详见源码。
