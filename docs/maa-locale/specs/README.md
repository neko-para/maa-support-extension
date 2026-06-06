# Maa Locale — 代码风格与约束

本包遵循 [通用代码规范](../extra/common-specs.md)，以下为 locale 特有的补充。

## 环境

- Node.js

## 架构模式

### 类型安全模板

```typescript
type CountBrace<Str, Cnt extends string[] = []> =
  Str extends `${string}{${number}}${infer Rest}`
    ? CountBrace<Rest, [...Cnt, '']>
    : Cnt['length']
```

利用递归条件类型计数占位符，编译期强制参数数量匹配。

### 可变单例

`locale` 和 `localeDict` 为模块级可变状态，适应插件和 CLI 的单例场景。

## 外部接口

API 定义在 [src/index.ts](../../../pkgs/maa-locale/src/index.ts)：

- `t(key, ...args)` — 翻译函数
- `setLocale(locale)` — 语言切换
- `LocaleType`, `LocaleIndex` — 类型导出

详见源码。
