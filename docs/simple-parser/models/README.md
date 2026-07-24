# Simple Parser — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 包标识

- **npm 包名**: `@nekosu/simple-parser`
- **类型**: LL\* 解析库

## 目标用户

- `@nekosu/maa-tasker` — MAA 表达式解析
- 任何需要轻量级解析器组合子的 TypeScript 项目

## 核心能力

### 1. 词法分析（Tokenization）

通过正则表达式定义 token 类型：

```typescript
const tokens = [
  ['virt', /\#[a-zA-Z]\w+/],
  ['number', /\d+/],
  ['task', /[a-zA-Z]\w*/]
] as const
```

### 2. 语法分析（Parsing）

通过流畅 API 定义 LL\* 文法规则：

```typescript
rule
  .for('expr')
  .when('%task', '%at', '%multi', '%plus', '%diff', '%brace')
  .do(([item]) => item)

rule
  .for('atList')
  .entry('%task')
  .when('atList', '%at')
  .do(([list, at]) => [...list, at])
```

支持循环文法（`withloop()`）处理列表。

### 3. 类型安全

Conditional types 提供完整的类型推导：

- 从 token 声明自动推导 token 名称类型
- `do()` 回调参数根据 `when()` 子句自动推导类型
- 表达式类型检查（`GetType` 条件类型）

## 抽象边界

本包是 monorepo 中最底层的库，零依赖。提供 PEG 风格的声明式解析器构建。
