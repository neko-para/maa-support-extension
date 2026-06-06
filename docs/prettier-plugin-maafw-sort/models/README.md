# Prettier Plugin Maafw Sort — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 包标识

- **npm 包名**: `@nekosu/prettier-plugin-maafw-sort`
- **类型**: Prettier 插件

## 目标用户

MaaFramework pipeline 文件的编辑者和 CI 流程。

## 核心能力

### 1. Pipeline Key 排序

对 pipeline JSON/JSONC 文件中的任务对象进行规范化 key 排序：

- 顶层任务 key 按标准顺序排列
- `recognition` 子对象: `type` → `param`
- `action` 子对象: `type` → `param`
- `swipes` 数组中的对象 key 排序
- `all_of` / `any_of` 数组中的任务对象排序

### 2. Interface 文件排序

对 `interface.json`/`interface.jsonc` 中的 `pipeline_override` 条目进行排序。

### 3. 文件过滤器

通过 Prettier 选项控制作用范围：

- `maafwPipelinePatterns` — 默认为 `[/pipeline/.*\\.jsonc?]`
- `maafwInterfacePatterns` — 默认为 `[/interface\\.jsonc?]`

### 4. 插件共存

`patchPlugin(plugin)` 将排序功能合并到其他 JSON Prettier 插件中，与 `prettier-plugin-multiline-arrays` 等共存。

### 5. Key 迁移

支持旧 key 到新 key 的映射（如 `doc` → `desc`）。

## 抽象边界

纯 Prettier 插件，通过 AST 操作实现排序，不涉及文件 I/O。
