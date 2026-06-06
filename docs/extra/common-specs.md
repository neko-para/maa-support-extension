# 通用代码规范

本 monorepo 基本共享同一套配置。以下规范适用于除 `webview`（浏览器环境）之外的所有包。

## TypeScript 规范

- **模块系统**: ES2022, `verbatimModuleSyntax`, `moduleResolution: "bundler"`
- **严格模式**: 启用所有 strict 检查
- **类型导入**: 使用 `import type` 进行类型专用导入
- **未使用变量**: `_` 前缀忽略（`argsIgnorePattern: '^_'`、`caughtErrorsIgnorePattern: '^_'`、`varsIgnorePattern: '^_'`）
- **构建工具**: `tsdown`（输出 ESM `.mjs` + `.d.mts`）

例外：
- `@mse/types`、`@mse/utils`：不构建，由消费方 bundler 直接链接 TypeScript 源码（这两个包不对外发布）
- `@nekosu/simple-parser`：核心运行时是纯 JavaScript + 手写 `.d.ts`（历史原因，JS/TS 有意隔离）
- `@mse/webview`：使用 Vite 构建，浏览器环境

## Prettier 配置

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "none",
  "arrowParens": "avoid",
  "printWidth": 100,
  "importOrder": ["^@(mse|nekosu)/", "^@/", "^\\."],
  "importOrderSeparation": true,
  "importOrderSortSpecifiers": true
}
```

## ESLint 配置

- TypeScript ESLint (`tseslint.configs.recommended`)
- Vue 插件 (`pluginVue.configs['flat/essential']`，仅 webview)
- `@typescript-eslint/no-unused-vars`: error，`_` 前缀忽略
- `vue/no-mutating-props`: error，`shallowOnly: true`
- 环境: Node.js（`globals.node`）→ 除 webview 外的所有包；Browser（`globals.browser`）→ webview

## 命名约定

- **类**: PascalCase — `InterfaceBundle`, `LayerInfo`
- **函数/方法**: camelCase — `parseTask()`, `buildRuntime()`
- **变量**: camelCase — `serverService`, `instMap`
- **常量**: 模块级变量 — `logger`；少数 SCREAMING_SNAKE_CASE — `MAAFW_MODULE_PATH`
- **类型/接口**: PascalCase — `ControllerRuntime`, `TaskInfo`；接口使用 `I` 前缀 — `IContentLoader`
- **品牌化类型**: `string & { __brand: 'Name' }` — `TaskName`, `AbsolutePath`
- **可辨识联合**: `type` 字段作为判别键
- **未使用的标识符**: `_` 前缀

## 架构模式

以下为项目中常见的模式：

- **DisposableHelper.defer**: 自动注册 disposable 对象（extension 专用）
- **FlushHelper**: debounce 批量处理模式
- **事件驱动**: `EventEmitter` 子类使用类型化事件映射
- **生成器函数**: 惰性 AST 遍历
- **脏标记缓存**: 懒计算 + `dirty` 失效策略
- **委托模式**: 抽象基类解耦数据源
- **Proxy 模式 IPC**: 类型安全双向 RPC

## 链接

- 根 ESLint 配置: [eslint.config.mts](../../../eslint.config.mts)
- 根 Prettier 配置: [.prettierrc](../../../.prettierrc)
