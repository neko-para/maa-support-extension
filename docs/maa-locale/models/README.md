# Maa Locale — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 包标识

- **npm 包名**: `@nekosu/maa-locale`
- **类型**: 共享国际化文案包

## 目标用户

- `@nekosu/maa-pipeline-manager` — 诊断消息国际化
- `@mse/extension` — VSCode 插件 UI 文案
- `@nekosu/maa-tools` — CLI 输出国际化

## 核心能力

### 1. 多语言翻译

提供 `t(key, ...args)` 函数进行类型安全的 key 查找和模板替换：

```typescript
t('maa.pi.error.cannot-find-task', taskName)
// → "无法找到任务 taskName" (zh)
// → "Cannot find task taskName" (en)
```

### 2. 语言切换

`setLocale('zh' | 'en')` 动态切换活动语言。

### 3. 类型安全的参数计数

`CountBrace<Str, Cnt>` 条件类型在编译期验证参数数量，防止运行时错误。

### 4. 命名空间组织

通过点分隔的 key 前缀组织文案：

- `maa.pi.*` — Pipeline Interface UI（含控制器配置错误提示，如 Linux 控制器缺失/截图输入方式无效/缺少 Wayland socket 路径）
- `maa.debug.*` — 调试相关
- `maa.pipeline.*` — Pipeline 诊断
- `maa.native.*` — 原生框架管理
- `maa.status.*` — 状态栏
- `maa.core.*` — 核心功能
- `maa.crop.*` — 裁剪工具
- `maa.screencap.*` — 快速截图命令
- `maa.shortcut.*` — 全局快捷键目标和运行控制提示
- `maa.eval.*` — 表达式求值

## 版本语义

本包遵循以下 SemVer 规则：

- **patch** — 修正或润色既有翻译，不改变 key、支持语言及占位参数含义
- **minor** — 新增翻译 key、支持语言或其他向后兼容的公开能力
- **major** — 删除或重命名 key、删除语言，或改变既有 key 的占位编号/参数含义等调用契约

最终渲染的本地化文本是面向用户的输出，不是供程序解析的稳定接口；消费者不应匹配完整文案。中英文字典必须具有相同 key 和相同占位编号集合，但为符合语序可以调整占位符在文本中的出现顺序。

发布时使用根目录的 `pnpm version-packages maa-locale=<level>` 生成联动计划。公开包通过发布后的精确版本依赖本包，因此 pipeline-manager、maa-tools 等运行时消费者需随 locale 新版本重新发布；脚本会自动安排最低 patch 升版。如果 locale 变化同时改变了依赖方自身的公开 API，应在同一命令中显式为该依赖方指定更高版本级别。

## 抽象边界

本包零依赖。支持的语言为简体中文 (`zh`) 和英文 (`en`)。
