# Maa Pipeline Manager — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 包标识

- **npm 包名**: `@nekosu/maa-pipeline-manager`
- **类型**: 核心语法解析支持库
- **版本**: 1.0.12

## 目标用户

本包是 monorepo 内部的核心引擎库，直接消费方包括：

- `@mse/extension` — VSCode 插件的所有语言特性
- `@nekosu/maa-tools` — CLI 检查器的 pipeline 加载和诊断
- `@mse/webview` — 仅通过 `./logic` 使用浏览器端运行时配置构建
- 间接消费方：通过 `@nekosu/maa-tools/pm` 子路径导出的外部用户

## 核心能力

### 1. Pipeline 文件解析

解析 JSON/JSONC 格式的 pipeline 文件，将原始 JSON AST 转换为结构化的符号图：

- **任务声明**: 解析任务定义中的所有属性和子结构
- **任务引用**: 提取 `next`、`sub`、`template`、`roi`、`target`、`color_filter` 等引用
- **锚点**: 解析 `[Anchor]`、`[JumpBack]` 等属性注解
- **图片引用**: 提取模板图片路径引用
- **Locale 引用**: 提取 `focus` 中的语言引用
- **颜色定义**: 解析 RGB/HSV 颜色范围
- **`recognition`/`action` 对象格式**: MaaFramework V2 语法
- **`baseTask` 继承 和 `@` 表达式**: MaaAssistantArknights 语法

### 2. Interface 文件解析

解析 `interface.json`/`interface.jsonc` 配置文件：

- Controller 定义和引用
- Resource 路径引用（含 `{PROJECT_DIR}` 解析）
- Task 定义和选项配置
- Option 定义（select/checkbox/switch/input）
- Preset 预设配置
- Group 分组
- Import 依赖
- 多语言 locale 路径映射

### 3. 自定义识别/操作解析器

支持通过 `ParserConfig` 注入自定义的 recognition 和 action 解析器，使外部消费者可以为自定义识别/操作类型提取特定的参数引用。

> **已知局限性**: 自定义解析器无法转发 `pipeline_override` 格式的内容，且其 AST 产物与标准解析的产物完全隔离。这是设计失误。

### 4. 分层任务存储

`LayerInfo` 提供父子层的任务存储，支持：

- 按层查找任务（含 MAA `@` 后缀追踪）
- 跨层合并声明和引用
- 任务配置求值（合并 `$Default`、识别类型默认值等）
- 格式切换（展开/折叠 `recognition`/`action` 对象）

> **注意**: 格式切换功能是实验性的，会丢失注释。目前官方推荐使用其他方法迁移。

### 5. Node.js 内容源抽象

- `FsContentLoader` / `FsContentWatcher` — 文件读写和 chokidar 监视
- `ContentJson<T>` — 带 debounce flush 的 JSON/JSONC 文件监视
- `Bundle` / `BundleManager` — pipeline 资源目录管理
- `InterfaceBundle.resolvePaths(controller, resource)` — 在不切换 active 状态的情况下计算有序资源路径，供批处理消费者规划隔离任务

`IContentLoader` / `IContentWatcher` 用于在 Node.js host 内替换内容来源，例如让 VS Code 未保存文档覆盖磁盘内容；它们不抽象 `Bundle`、`InterfaceBundle` 的文件路径、事件循环和目录监视语义，因此不是通用的浏览器文件系统适配层。

### 6. 诊断引擎

对 pipeline 和 interface 文件进行完整性检查（约 25 种诊断类型）：

- 任务冲突检测
- 未知引用检测（任务、锚点、图片、属性）
- 重复条目检测
- 模板路径格式验证
- Locale 完整性检查
- Option 类型正确性验证
- Preset 一致性验证

### 7. 运行时配置构建

从 interface 配置和用户选择构建可执行的运行时对象：

- `buildControllerRuntime()` — 构建控制器运行时常量；默认读取 MaaFramework 全局常量，也可通过第三个参数显式注入 `ControllerRuntimeConstants`，供无原生绑定的浏览器预览等环境使用
- `buildResourceRuntime()` — 构建资源路径运行时
- `buildOption()` — 解析选项依赖链
- `buildTaskRuntime()` — 构建带 pipeline override 的任务运行时

Select、Switch 和 Checkbox 在用户未提供显式配置时均使用各自的 `default_case`。Checkbox 默认选中的 case 会参与子选项依赖解析和 `pipeline_override` 构建。

## 抽象边界

本包提供两个明确的运行时入口：

- `@nekosu/maa-pipeline-manager` — Node.js 入口，包含文件加载、chokidar 监视、路径编排、解析和诊断
- `@nekosu/maa-pipeline-manager/logic` — 浏览器安全入口，只包含 interface 类型和无 I/O 的 runtime/option 构建

浏览器消费者必须使用 `./logic`，不得从主入口导入。CI 会以 browser platform 实际打包该子路径，防止 Node.js API 越过入口边界。
