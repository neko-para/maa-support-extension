# Simple Parser — 技术架构

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用技术约定](../extra/common-tech.md)。零依赖包。

## 模块架构

```
src/
├── impl.js          # 核心运行时: SimpleParser 类 (纯 JS)
├── impl.d.ts        # 手写运行时类型声明
└── index.ts         # TypeScript facade:
                     #   makeParser()、declExpr()、
                     #   条件类型 EDSL
```

## 核心实现

### 词法分析

`SimpleParser` 类实现：

- 正则 token 匹配
- `ignore` 模式过滤空白/注释
- Token 流提供 `read()`/`peek()` 接口

### 语法分析

LL\* 解析策略：

- 基于文法规则的递归下降
- `withloop()` 支持左递归处理列表
- `sameas()` 引用已有规则

## 技术选型

| 选择                    | 理由                                       |
| ----------------------- | ------------------------------------------ |
| 纯 JS 核心              | 源自独立项目，JS 和 TS 有意隔离            |
| 手写 `.d.ts` + 类型体操 | TS facade 层通过条件类型提供精确的类型提示 |
| 条件类型 EDSL           | 编译期验证文法正确性                       |
| PEG 风格                | 声明式文法定义，无歧义                     |
