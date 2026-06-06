# Maa Locale — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 包标识

- **npm 包名**: `@nekosu/maa-locale`
- **类型**: 共享国际化文案包

> **设计失误**: 本包的本意是避免插件和 checker 的文案不一致，但直接发布到 npm 导致版本更新不明确——文案的变更难以通过语义化版本传达。

## 目标用户

- `@nekosu/maa-pipeline-manager` — 诊断消息国际化
- `@mse/extension` — VSCode 插件 UI 文案
- `@nekosu/maa-tools` — CLI 输出国际化

## 核心能力

### 1. 多语言翻译

提供 `t(key, ...args)` 函数进行类型安全的 key 查找和模板替换：

```typescript
t('maa.pi.error.cannotFindTask', taskName)
// → "无法找到任务: taskName" (zh)
// → "Cannot find task: taskName" (en)
```

### 2. 语言切换

`setLocale('zh' | 'en')` 动态切换活动语言。

### 3. 类型安全的参数计数

`CountBrace<Str, Cnt>` 条件类型在编译期验证参数数量，防止运行时错误。

### 4. 命名空间组织

通过点分隔的 key 前缀组织文案：

- `maa.pi.*` — Pipeline Interface UI
- `maa.debug.*` — 调试相关
- `maa.pipeline.*` — Pipeline 诊断
- `maa.native.*` — 原生框架管理
- `maa.status.*` — 状态栏
- `maa.core.*` — 核心功能
- `maa.crop.*` — 裁剪工具
- `maa.eval.*` — 表达式求值

## 抽象边界

本包零依赖。支持的语言为简体中文 (`zh`) 和英文 (`en`)。
