# Maa Locale — 技术架构

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 模块架构

```
src/
├── index.ts          # 入口: setLocale(), t(), locale
├── locale.zh-cn.ts   # 简体中文字典 (as const)
├── locale.en.ts      # 英文字典 (as const)
└── local.d.ts        # LocaleIndex 类型
```

## 设计

### 字典结构

```typescript
// locale.zh-cn.ts
export const zhDict = {
  'maa.pi.error.cannotFindTask': '无法找到任务: {0}',
  'maa.pi.error.duplicateTasks': '任务冲突: {0} 和 {1}',
  // ...
} as const
```

### t() 实现

```typescript
function t<K extends LocaleIndex>(key: K, ...args: CountArgs<K>): string {
  const tmpl = localeDict[key]
  return tmpl.replace(/\{(\d)\}/g, (_, idx) => args[Number(idx)])
}
```

## 依赖关系

零运行时依赖。仅 `devDependencies` 中的 TypeScript。

## 技术选型

| 选择 | 理由 |
|---|---|
| `as const` 字典 | 保留字面量类型以支持条件类型推断 |
| 条件类型 (`CountBrace`) | 编译期参数数量验证，零运行时开销 |
| 零依赖 | 被多个包消费，最小化传递依赖 |
| 模块级单例 | 适合插件和 CLI 的单例场景 |
