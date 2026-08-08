# Maa Pipeline Manager — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 包标识

- **npm 包名**: `@nekosu/maa-pipeline-manager`
- **类型**: 核心语法解析支持库
- **版本**: 1.0.12

> **已知设计失误**: 模块内依赖了 Node.js 的能力（如 `fs`、`path`），导致无法在 browser 环境中使用。即使做了 `IContentLoader` / `IContentWatcher` 等 FS 层抽象接口，底层实现仍然深度耦合 Node API。
>
> **已知罕见 Bug**: 在插件和 checker 同时执行时，有概率错误删除所有图片文件（可能还有其他文件）。代码层面没有任何删除操作，怀疑与 watch 库有关，但理论上不应该发生。

## 目标用户

本包是 monorepo 内部的核心引擎库，直接消费方包括：

- `@mse/extension` — VSCode 插件的所有语言特性
- `@nekosu/maa-tools` — CLI 检查器的 pipeline 加载和诊断
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

### 5. 文件系统抽象

- `FsContentLoader` / `FsContentWatcher` — 文件读写和 chokidar 监视
- `ContentJson<T>` — 带 debounce flush 的 JSON/JSONC 文件监视
- `Bundle` / `BundleManager` — pipeline 资源目录管理
- `InterfaceBundle.resolvePaths(controller, resource)` — 在不切换 active 状态的情况下计算有序资源路径，供批处理消费者规划隔离任务

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

- `buildControllerRuntime()` — 构建控制器运行时常量
- `buildResourceRuntime()` — 构建资源路径运行时
- `buildOption()` — 解析选项依赖链
- `buildTaskRuntime()` — 构建带 pipeline override 的任务运行时

Select、Switch 和 Checkbox 在用户未提供显式配置时均使用各自的 `default_case`。Checkbox 默认选中的 case 会参与子选项依赖解析和 `pipeline_override` 构建。

## 抽象边界

本包是 **TypeScript 库**，设计目标是无 I/O、无原生依赖。但实际存在 Node.js API 耦合（见顶部设计失误说明）。
