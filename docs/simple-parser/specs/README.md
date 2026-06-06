# Simple Parser — 代码风格与约束

本包遵循 [通用代码规范](../extra/common-specs.md)，以下为 simple-parser 特有的补充。

## 技术特征

- **核心引擎**: 纯 JavaScript（`impl.js`），源自独立项目
- **公共 API**: TypeScript（`index.ts`）
- **JS/TS 隔离**: 由于 JS 中 hack 较多，JS 和 TS 有意保持隔离。类型安全通过手写 `.d.ts`（`impl.d.ts`）和 TypeScript facade 层提供

## 架构模式

### JavaScript + TypeScript 混合

类型安全通过独立的手写 `.d.ts` 和 TypeScript facade 层提供——facade 层实现了复杂的条件类型体操，为 `makeParser()` 提供精确的类型提示。

### 条件类型 EDSL

使用 TypeScript 条件类型实现编译期语法验证：

- `TokenArray<Decls, Results>` — 提取 token 名称
- `BuildToken<Tokens>` — 添加 `%` 前缀
- `GetType<Tokens, Exprs, Expr>` — 推断表达式类型
- `ConvertArguments<Tokens, Exprs, WhenExprs>` — 推导 `do()` 参数类型
- `EnableIf<Enable, Type>` — 条件启用

### 流畅 Builder

```typescript
rule.for('expr')
  .when('%token1', 'subrule')
  .do(([tok, sub]) => result)
```

## 外部接口

API 定义在 [src/index.ts](../../../pkgs/simple-parser/src/index.ts)。运行时实现在 [src/impl.js](../../../pkgs/simple-parser/src/impl.js)。
