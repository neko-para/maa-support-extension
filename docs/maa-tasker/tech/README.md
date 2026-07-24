# Maa Tasker — 技术架构

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用技术约定](../extra/common-tech.md)。

## 模块架构

```
src/
├── index.ts          # API 入口
├── types.ts          # MAA 任务数据模型
│                     # MaaTask, MaaTaskExpr, MaaTaskMatchTemplate,
│                     # MaaTaskOcrDetect, MaaTaskFeatureMatch, etc.
├── props.ts          # 属性元数据
│                     # TaskBaseProps, TaskExprProps,
│                     # TaskExprVirts, shouldStrip()
├── expr/             # 表达式引擎
│   ├── index.ts      # parseExpr() / buildExpr()
│   ├── types.ts      # AST 类型定义
│   ├── parser.ts     # 基于 @nekosu/simple-parser 的解析器
│   └── build.ts      # AST → 字符串序列化
└── eval/             # 任务解析引擎
    ├── types.ts      # 内部类型: MaaTaskBaseResolved, MaaTraceAnchor
    ├── context.ts    # 核心求值器: MaaEvalContext, MaaEvalContextImpl
    └── utils.ts      # mergeTask(), applyParentToTask(), dedup
```

## 核心算法

### 任务链解析 (`MaaEvalContextImpl.evalTask`)

```
TaskA@TaskB@TaskC
  → 从 TaskC 开始
  → 用 TaskB 的属性覆盖
  → 用 TaskA 的属性覆盖
  → 返回最终合并结果
```

### baseTask 继承 (`resolveBaseTask`)

```
Task 中 baseTask: "BaseTask"
  → 递归获取 BaseTask 的定义
  → mergeTask(baseTask, current, mode='baseTask')
  → 清除 resolved 的 baseTask 字段
```

### 表达式求值 (`evalExpr`)

支持操作符优先级：

1. `#virt` — 虚拟属性引用
2. `@` — 链式继承（前缀粘连）
3. `*N` — 重复
4. `+` — 联合
5. `^` — 差集

### 属性合并 (`mergeTask`)

- `@` 模式: 保留 `baseTask`（除非 algorithm 改变），覆盖其他属性
- `baseTask` 模式: 清除 `baseTask` 字段，合并其他属性
- 保留每个属性的 `trace` 信息

## 依赖关系

| 包                      | 角色                 |
| ----------------------- | -------------------- |
| `@nekosu/simple-parser` | 表达式词法和语法解析 |

## 技术选型

| 选择                | 理由                                       |
| ------------------- | ------------------------------------------ |
| 零原生依赖          | 可纯静态分析，无需 MaaFramework 运行时     |
| Trace-based merging | 下游诊断可追溯 "哪个文件定义了这个属性"    |
| 委托模式            | 解耦数据源，支持文件系统/数据库/测试 mock  |
| 循环检测            | evalTask 和 evalExpr 均有 visited set 防护 |
| 上限保护            | `@` 链展开超过 100,000 元素时中止          |
