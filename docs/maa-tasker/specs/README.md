# Maa Tasker — 代码风格与约束

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用代码规范](../extra/common-specs.md)，以下为 tasker 特有的补充。

## 架构模式

### 委托模式

核心求值器通过抽象委托与外部数据源解耦：

```typescript
abstract class MaaEvalDelegate {
  abstract query(task: string): Promise<MaaTaskWithTraceInfo | null>
}
```

### 可辨识联合 AST

表达式 AST 使用 `type` 字段判别：

```typescript
type MaaTaskExprAst =
  | { type: 'task'; name: string }
  | { type: 'brace'; expr: MaaTaskExprAst }
  | { type: 'at'; tasks: AtTask[]; virt?: string }
  | ...
```

### 函数重载

`mergeTask()` 使用函数重载区分 `@` 模式和 `baseTask` 模式的合并语义。

### 属性追踪

每个 resolved 属性附带 `MaaTraceAnchor`，记录源文件和锚点。

## 外部接口

核心 API 定义在 [src/index.ts](../../../pkgs/maa-tasker/src/index.ts)：

- `parseExpr(expr)` / `buildExpr(ast)` — 表达式解析/序列化
- `MaaEvalContext` — 任务求值门面
- `MaaEvalDelegate` — 数据源抽象基类
- `MaaErrorDelegate` — 错误处理
- `MaaTask`, `MaaTaskExpr`, `MaaTaskExprAst` — 核心类型

详见源码。
