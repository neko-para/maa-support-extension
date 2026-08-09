# 国际化文案体系

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 当前设计

本 monorepo 有意保留两套 locale 系统，分别对应 host/CLI 与 Vue Webview 两种运行时：

### 1. `@nekosu/maa-locale`（共享包）

- 位置: [pkgs/maa-locale/](../../pkgs/maa-locale/)
- 消费方: `@nekosu/maa-pipeline-manager`, `@mse/extension`, `@nekosu/maa-tools`
- 支持语言: 简体中文 `zh`、英文 `en`
- 文档: [maa-locale/models/](../maa-locale/models/)

### 2. Webview 独立 locale（内嵌）

- 位置: [pkgs/webview/src/utils/locale/](../../pkgs/webview/src/utils/locale/)
- 消费方: `@mse/webview` 三个 Vue 应用中
- 支持语言: 简体中文 `zh`、英文 `en`
- 状态模型: Vue `ref` / `computed`，locale 变化会触发组件重新渲染

## 差异

| 方面       | `@nekosu/maa-locale`  | Webview locale            |
| ---------- | --------------------- | ------------------------- |
| 发布方式   | npm 包                | 内联源码                  |
| 构建       | tsdown                | Vite                      |
| 消费方式   | `import { t }`        | `import { t }`            |
| 字典内容   | 插件宿主端 + 诊断消息 | Webview UI 文案           |
| 状态模型   | 模块级单例            | Vue 响应式状态            |
| 依赖       | 零                    | Vue                       |
| 运行时环境 | Node.js               | Browser (webview sandbox) |

两套英文字典的精确 key 集合没有交集：Webview 的 164 个 key 都是 control/crop/launch UI 文案，`@nekosu/maa-locale` 的 125 个 key 属于 extension host、pipeline-manager 与 checker。字典不共享不会造成同一文案的双份维护。

## 保留独立实现的原因

- Webview 需要响应式 locale；`@nekosu/maa-locale` 的模块级状态适合扩展进程和一次性 CLI，不应引入 Vue 概念
- 将 Webview 字典并入公开 npm 包会使纯 UI 文案参与包版本传播，扩大 TODO-21 所记录的版本语义问题
- 真正重复的只有 `{0}`、`{1}` 占位符替换和 `CountBrace` 参数计数模式，规模约十几行；抽成共享 API 的依赖和发布成本高于收益
- 两边仍统一使用 `zh` / `en` locale 标识、点分 key 与连续数字占位符，避免使用方式无谓分化

只有在出现实际共享 key、增加更多语言导致 fallback 逻辑复杂化，或占位符格式化能力明显扩展时，才重新评估抽取独立的纯函数 locale core；响应式适配和字典归属仍应留在各自运行时。
