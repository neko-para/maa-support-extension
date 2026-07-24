# Maa Tasker — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 包标识

- **npm 包名**: `@nekosu/maa-tasker`
- **类型**: MAA 任务解析求值库
- **版本**: 1.0.0

## 目标用户

- `@nekosu/maa-pipeline-manager` — 用于任务解析和诊断
- 任何需要理解 MAA 任务关系而无须运行原生框架的工具

## 核心能力

### 1. MAA 表达式解析

提供一个小型 DSL 的解析器和序列化器，用于 MAA 任务引用表达式：

- **`@` 链式继承**: `TaskA@TaskB` — "从 TaskB 继承并用 TaskA 覆盖"
- **`#` 虚拟属性**: `#next`、`#self`、`#back`、`#sub`
- **`*` 重复**: `Task*3`
- **`+` 联合**: `TaskA+TaskB`
- **`^` 差集**: `TaskA^TaskB`
- **括号分组**: `(TaskA+TaskB)@BaseTask`

提供 `parseExpr()` 和 `buildExpr()` 两个方向的转换。

### 2. 任务解析求值

纯 TypeScript 实现的 MAA pipeline 解析逻辑：

- **`baseTask` 继承**: 解析并合并基础任务属性
- **`@` 链解析**: 追踪多层任务覆盖链（支持任意深度）
- **表达式属性求值**: 求值 `sub`、`next`、`exceededNext`、`onErrorNext` 等表达式列表
- **虚拟属性解析**: `#self` 引用自身、`#back` 引用调用者
- **属性追踪**: 每个 resolved 属性记录其源文件/锚点

### 3. 错误委托

`MaaErrorDelegate` 提供可重写的错误处理，包括：

- 任务循环检测
- 表达式循环检测
- 缺失任务检测
- 解析错误
- 递归展开过大（超过 100,000 元素）

## 抽象边界

本包是 **纯算法库**，不包含：

- 文件 I/O
- 网络请求
- MaaFramework 原生调用
- 任何 UI

所有数据通过 `MaaEvalDelegate.query()` 抽象方法注入。
