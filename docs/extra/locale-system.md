# 国际化文案体系

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 当前状态

本 monorepo 存在 **两套独立的 国际化系统**：

### 1. `@nekosu/maa-locale`（共享包）

- 位置: [pkgs/maa-locale/](../../pkgs/maa-locale/)
- 消费方: `@nekosu/maa-pipeline-manager`, `@mse/extension`, `@nekosu/maa-tools`
- 支持语言: 简体中文 `zh`、英文 `en`
- 文档: [maa-locale/models/](../maa-locale/models/)

### 2. Webview 独立 locale（内嵌）

- 位置: [pkgs/webview/src/utils/locale/](../../pkgs/webview/src/utils/locale/)
- 消费方: `@mse/webview` 三个 Vue 应用中
- 支持语言: 简体中文 `zh`、英文 `en`
- 实现方式: 复制了与 `@nekosu/maa-locale` 几乎相同的 `t()` 函数和 `CountBrace` 条件类型

## 差异

| 方面       | `@nekosu/maa-locale`  | Webview locale            |
| ---------- | --------------------- | ------------------------- |
| 发布方式   | npm 包                | 内联源码                  |
| 构建       | tsdown                | Vite                      |
| 消费方式   | `import { t }`        | `import { t }`            |
| 字典内容   | 插件宿主端 + 诊断消息 | Webview UI 文案           |
| 依赖       | 零                    | 零                        |
| 运行时环境 | Node.js               | Browser (webview sandbox) |

## 已知问题

1. **代码重复**: `t()` 函数实现和 `CountBrace` 条件类型在两处几乎完全相同
2. **字典不共享**: 两端各自维护独立的翻译字典，无自动同步
3. **命名空间重叠**: 两套系统使用不同的 key 命名约定

## 可能的整合方案

参见 [QUESTION.md](../../../QUESTION.md) 中的相关问题。
