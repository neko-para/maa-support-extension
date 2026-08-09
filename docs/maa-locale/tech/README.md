# Maa Locale — 技术架构

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用技术约定](../extra/common-tech.md)。零依赖包。

## 模块架构

```
src/
├── index.ts          # 入口: setLocale(), t(), locale
├── locale.zh-cn.ts   # 简体中文字典 (as const)
└── locale.en.ts      # 英文字典 (as const)
test/
└── index.test.ts     # key 集合与占位参数契约一致性
```

## 设计

### 字典结构

```typescript
// locale.zh-cn.ts
export const zhDict = {
  'maa.pi.error.cannotFindTask': '无法找到任务: {0}',
  'maa.pi.error.duplicateTasks': '任务冲突: {0} 和 {1}'
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

## 技术选型

| 选择                    | 理由                             |
| ----------------------- | -------------------------------- |
| `as const` 字典         | 保留字面量类型以支持条件类型推断 |
| 条件类型 (`CountBrace`) | 编译期参数数量验证，零运行时开销 |
| 模块级单例              | 适合插件和 CLI 的单例场景        |

英文词典定义 `t()` 接受的 key 与参数数量，中英文 key 完整性由 TypeScript 赋值检查和包级测试共同保证。测试还比较每个 key 的占位编号集合，允许翻译按语言语序重新排列占位符，但阻止漏传、新增或误写参数编号。版本兼容规则见[产品定义](../models/README.md#版本语义)。

## 与 Webview locale 的边界

本包只承载 extension host、pipeline-manager 和 checker 共享的文案及模块级 locale 状态。Vue Webview 需要响应式 locale，且 UI 字典与本包没有相同 key，因此保留位于 `@mse/webview` 内的独立实现，不将 Vue UI 文案纳入本公开包的版本传播。完整结论见 [locale-system.md](../../extra/locale-system.md)。
