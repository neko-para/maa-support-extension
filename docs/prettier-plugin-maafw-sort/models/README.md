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

- 顶层任务 key 按标准顺序排列（任务名本身不排序）
- `recognition` 子对象: `type` → `param`
- `action` 子对象: `type` → `param`
- `swipes` 数组、wait_freezes（对象或数组）、`focus` 对象的内部 key 排序
- `all_of` / `any_of` 数组中的任务对象排序
- `$` 前缀的 root field 不是任务，不参与排序

### 2. Interface Key 排序

对 `interface.json`/`interface.jsonc` 以及被其 `import` 的片段文件排序。只排对象 key 顺序，所有数组顺序保留（`import[]`/`task[]`/`controller[]`/`resource[]`/`cases[]`/`resource.path[]`/option 引用数组等顺序均有协议语义，影响 UI 展示与合并结果）：

- 根级 key 遵循协议文档（ProjectInterfaceV2）的字段介绍顺序: `interface_version` → `languages` → 元信息（`name`/`label`/`mirrorchyan_*`/`telemetry` 等）→ `controller`（含 `default_controller`/`lock_controller`）→ `resource` → `pretask` → `agent` → `group` → `task` → `option` → `global_option` → `setting` → `import` → `preset`；`$` 前缀 root field（如 `$schema`）保持原位不参与排序
- controller/resource/task/option/case/input/preset/preset-task/pretask/setting/agent/group 条目按各自标准 key 顺序
- `pipeline_override` 内部按 Pipeline 任务排序规则处理；section 形状异常时退回递归查找 `pipeline_override` 兜底
- `option` Record 与 `languages` 的 key 属于数据，不排序
- 片段文件命名任意、不匹配 pattern，通过内容探测兜底（见下）

### 3. Locale 文件排序

对路径匹配 `/locales/.*\.jsonc?`（默认，`maafwLocalePatterns` 可配）的翻译 map——通常即 `languages` 指向的文件；插件只匹配路径，不跟踪 `languages` 引用——按 UTF-16 码元字典序（locale 无关、跨环境确定）递归排序全部对象 key。locale 文件是纯数据 map，key 无语义顺序，字典序可最大化 diff 稳定性；数组顺序保留。默认会命中任何含 `/locales/` 的路径（如 webview / 文档站的 i18n），传 `[]` 关闭。

### 4. 文件过滤器与内容探测

通过 Prettier 选项控制作用范围：

- `maafwPipelinePatterns` — 默认为 `[/pipeline/.*\.jsonc?]`
- `maafwInterfacePatterns` — 默认为 `[/interface\.jsonc?]`，只增加显式覆盖，不能关闭探测
- `maafwLocalePatterns` — 默认为 `[/locales/.*\.jsonc?]`
- `maafwInterfaceDetect` — 默认开启，对任意路径的 json/jsonc 生效。pattern 均未命中时，按强信号判定是否为 interface 文件：
  - `task`/`controller`/`resource`/`preset` 数组中存在含字符串 `name` 及对应标志 key 的条目（`task`→`entry`、`controller`→`type`、`resource`→`path`、`preset`→`task`），或
  - `option` Record 存在含 `cases`/`inputs`/`hotkeys`/`default_case`/`pipeline_override` 的条目。

  纯字符串数组（如 `"task": ["build", "test"]`）不会触发；仅含 `group`/`global_option`/`setting` 的片段信号太弱不单独触发，需 pattern 覆盖。

### 5. 插件共存

`patchPlugin(plugin)` 将排序功能合并到其他 JSON Prettier 插件中，与 `prettier-plugin-multiline-arrays` 等共存。

解析器匹配 Pipeline / Interface / Locale 模式时静默执行，不向控制台写入调试信息。

### 6. Key 迁移

支持旧 key 到新 key 的映射（如 `doc` → `desc`）。

## 抽象边界

纯 Prettier 插件，通过 AST 操作实现排序，不涉及文件 I/O。
