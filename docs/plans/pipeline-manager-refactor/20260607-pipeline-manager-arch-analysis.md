# Pipeline Manager — 架构分析与问题诊断

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 一、模块全景

```
                    ┌──────────────────────────────┐
                    │     @mse/extension (LSP)      │
                    │  completion / hover / ...     │
                    └──────────────┬───────────────┘
                                   │ depends on
                    ┌──────────────▼───────────────┐
                    │     @nekosu/maa-tools (CLI)   │
                    │  checker / test-runner        │
                    └──────────────┬───────────────┘
                                   │ depends on
            ┌──────────────────────┼──────────────────────┐
            │                      ▼                      │
            │  ┌───────────────────────────────────────┐  │
            │  │   @nekosu/maa-pipeline-manager        │  │
            │  │                                       │  │
            │  │  ┌─────────────┐  ┌────────────────┐  │  │
            │  │  │  content/   │  │  interface/    │  │  │
            │  │  │  loader.ts  │  │  interface.ts  │  │  │
            │  │  │  watch.ts   │  │  (InterfaceBndl)│  │  │
            │  │  │  json.ts    │  │  language.ts   │  │  │
            │  │  └──────┬──────┘  └───────┬────────┘  │  │
            │  │         │                  │           │  │
            │  │    Node.js APIs       EventEmitter     │  │
            │  │    (fs, path,         (node:events)    │  │
            │  │     chokidar,                           │  │
            │  │     process,                            │  │
            │  │     setTimeout)                         │  │
            │  │         │                  │           │  │
            │  │    ┌────▼──────────────────▼────────┐  │  │
            │  │    │  bundle/                        │  │  │
            │  │    │  bundle.ts (EventEmitter)       │  │  │
            │  │    │  manager.ts (debounce + watch)  │  │  │
            │  │    └──────────────┬─────────────────┘  │  │
            │  │                   │                     │  │
            │  │    ┌──────────────▼─────────────────┐  │  │
            │  │    │  layer/layer.ts                │  │  │
            │  │    │  (task storage, merged decls)  │  │  │
            │  │    └──────────────┬─────────────────┘  │  │
            │  │                   │                     │  │
            │  │    ┌──────────────▼─────────────────┐  │  │
            │  │    │  parser/        diagnostic/     │  │  │
            │  │    │  (pure logic)   (pure logic)   │  │  │
            │  │    └────────────────────────────────┘  │  │
            │  └───────────────────────────────────────┘  │
            └────────────────────────────────────────────┘
```

## 二、核心问题

### 问题 1：关注点混杂——同一模块承担三层职责

当前 `maa-pipeline-manager` 实际承担了三层不同性质的职责：

| 层级         | 职责                                     | 模块                                                                  | 对环境的依赖                                      |
| ------------ | ---------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------- |
| **I/O 层**   | 文件读写、监视、debounce                 | `content/`, `bundle/manager.ts`                                       | `fs`, `path`, `chokidar`, `process`, `setTimeout` |
| **编排层**   | 响应文件事件、协调解析流程、管理生命周期 | `bundle/bundle.ts`, `interface/interface.ts`, `interface/language.ts` | `EventEmitter`, `setTimeout`                      |
| **纯逻辑层** | AST 解析、类型定义、符号匹配、诊断       | `parser/`, `layer/`, `diagnostic/`, `logic/`, `utils/`                | 仅 `path`（部分 `utils/types.ts`）                |

这三层被打包为**同一个 npm 包**。消费者（extension、maa-tools）无法选择只使用纯逻辑层——必须引入整个包，包括 Node.js I/O 层。

### 问题 2：Node.js 深度耦合（TODO-22）

`IContentLoader` / `IContentWatcher` 接口的初衷是抽象 I/O 层，但存在三个失败点：

1. **接口设计追随实现**：`IContentWatcher.watch()` 返回 `IContentWatcherController`（只有 `stop()`），这完全是 `chokidar` 的投影。如果换成 browser `FileSystemObserver`，接口需要重新设计。

2. **Node API 泄漏到纯逻辑层**：
   - `LayerInfo` 构造函数接受 `IContentLoader` 参数——但 `LayerInfo` 是纯数据结构，不需要知道 I/O
   - `content/json.ts` 中 `process.nextTick()` 是 Node 专有 API
   - `bundle/manager.ts` 中 `setTimeout` 用于 debounce，应该是不依赖平台的定时器抽象

3. **`node:path` 污染**：`utils/types.ts` 定义了 `joinPath` 等品牌化路径辅助函数，但内部实现仍是 `path.join`。在 browser 中需要不同的实现。

### 问题 3：事件驱动强制（TODO-24）

`Bundle`、`InterfaceBundle`、`LanguageBundle` 全部继承 `EventEmitter`：

```
InterfaceBundle (EventEmitter)
  ├── on('interfaceChanged')  → 更新 paths, langs, imports
  ├── on('activeChanged')     → 更新 paths
  ├── on('importChanged')     → 加载 import 文件
  ├── on('pathChanged')       → 重建 Bundle 链
  ├── on('bundleReloaded')    → 绑定子 Bundle 事件
  └── on('localeChanged')     → 更新 layer extraDecls/extraRefs

Bundle (EventEmitter)
  ├── on('reset')
  ├── on('taskChanged')
  └── on('imageChanged')

LanguageBundle (EventEmitter)
  └── on('localeChanged')
```

事件链形成复杂的因果网络：一个文件变化 → watcher 事件 → debounce → flush → parse → emit → 多个 listener 响应 → 更多 emit。checker 侧的同步查询需求与事件流模型存在根本冲突——checker 需要"给我当前完整结果"，但系统设计为"订阅变更流，自己维护状态"。

### 问题 4：LayerInfo 求值逻辑混入数据层

`Layer` 的定位是**抽象一层 Resource**——这是有意设计。interface.json 自身也是一个 Layer，位于顶层。层的父子关系对应 MaaFramework 的 resource 继承语义。

但 `LayerInfo` 在数据存储之外混入了求值逻辑：

- 数据存储（tasks, images, extraDecls, extraRefs）—— 正确
- 数据查询（getTaskList, getAnchorList, getImageList, getTask, getImage）—— 正确
- 层次遍历（mergedDecls, mergedAllDecls, parent 链）—— 正确
- **数据求值（evalTask）**—— 应独立于数据层
- **格式转换（toggleMode, specialStringify）**—— 应独立

求值逻辑（`evalTask`）混在数据查询层中，使得测试求值行为必须构造完整的 `LayerInfo` 树。

### 问题 5：InterfaceBundle 作为统一入口的设计张力

`InterfaceBundle` 被设计为**外部统一入口**，匹配 MaaFramework 对 interface.json + resource 体系的定义。这个定位本身是合理的。

问题在于它同时承担了过多实现细节：

- 文件监视器（通过 ContentJson）
- 解析调度器（通过事件回调中的 parseInterface）
- 依赖管理器（imports 跟踪）
- Bundle 管理器（创建/销毁 Bundle 链）
- 配置管理器（switchActive）
- 数据容器（info, paths, bundles）
- MAA 求值代理（eval, maaEvalTask）

它接收 `IContentLoader` + `IContentWatcher`，管理整个生命周期，并通过事件向外广播。这让 checker 侧难以使用——必须创建一个"活"的 InterfaceBundle 实例，即使只需要一次静态查询。

**额外历史问题**：最初插件不支持 maa-tools 的配置格式，后来改为支持。这导致配置处理逻辑的位置不合适，需要在此次重构中重新安置。

### 问题 6：配置处理位置不当

maa-tools 的配置支持是后续添加的。当前配置相关逻辑分散在 `logic/` 和 `interface/interface.ts`（`switchActive`、`updatePaths` 等）中，缺乏明确的设计边界。

### 问题 7：诊断文案缺乏设计

诊断引擎（`diagnostic/`）当前产生的 `Diagnostic` 类型仅包含结构化数据（`type`、`task`、`offset` 等）。但**诊断文案**（人类可读的诊断消息）散落在两处：

- `diagnostic/message.ts`：`buildDiagnosticMessage()` — 在 pipeline-manager 库中
- `@nekosu/maa-locale`：国际化翻译 — 在独立包中

按照设计原则，pipeline-manager 的诊断不应该包含任何文案逻辑。文案应完全属于展示层（LSP/locale）。当前 `diagnostic/message.ts` 的存在是边界模糊的结果。

### 问题 8：mergeXXX 函数缺乏设计

`mergedDecls`、`mergedRefs`、`mergedAllDecls`、`mergedAllRefs` 等函数当前是简单的模式提取——将"遍历 tasks 收集 decls/refs"的重复代码抽取为公共函数。但它们缺乏统一的设计：

- 缓存策略（`dirty` 标记 + 懒计算）直接写在 `LayerInfo` 中
- 没有清晰的"查询接口"概念——外部调用者直接访问属性
- 跨层合并逻辑（`parent?.mergedAllDecls`）与单层逻辑混在一起

## 三、依赖关系图

```
EventEmitter (node:events)
  ├── Bundle
  ├── InterfaceBundle
  └── LanguageBundle

IContentLoader (interface)
  └── FsContentLoader → fs.readFile

IContentWatcher (interface)
  └── FsContentWatcher → chokidar

ContentJson → IContentLoader + IContentWatcher + process.nextTick + setTimeout
BundleManager → IContentLoader + IContentWatcher + setTimeout
Bundle → IContentLoader + IContentWatcher + path + EventEmitter
InterfaceBundle → ContentJson + EventEmitter + path + Bundle
LanguageBundle → ContentJson + EventEmitter + path
LayerInfo → IContentLoader + path

Parser / Diagnostic / Logic → (无 Node 依赖，纯逻辑)
```

纯逻辑层（Parser、Diagnostic、Logic）实际不依赖 Node API。但它们被混在依赖 Node API 的模块中发布。

## 四、对消费者的影响

### Extension (LSP Provider)

需要文件监视能力。当前通过 `InterfaceBundle` 的事件驱动模型获取数据变更通知，与 VSCode 的 Provider 生命周期配合良好。但：

- 每次查询都需要穿透 `InterfaceBundle → LayerInfo` 的层级
- `makeDecls`/`makeRefs` 等匹配逻辑写在 LSP 侧（`base.ts`），无法在 checker 侧复用

### maa-tools (CLI Checker)

需要同步的一次性结果。当前被迫：

- 创建完整的 `InterfaceBundle` + `BundleManager` + watcher
- 等待事件循环完成解析
- 提取结果后手动 `stop()` 所有 watcher
- 事件驱动模型完全不适合"输入文件 → 输出诊断"的命令行模式

## 五、可测试性现状

| 模块          | 可测试性 | 障碍                                                               |
| ------------- | -------- | ------------------------------------------------------------------ |
| `parser/`     | 良好     | `parseTask()` 接受 Node 参数——需要构造 jsonc-parser AST。可 mock。 |
| `diagnostic/` | 中等     | 依赖 `InterfaceBundle` 和 `LayerInfo`——需要构造完整的数据结构      |
| `layer/`      | 差       | 依赖 `IContentLoader`，混入求值逻辑，无法独立实例化                |
| `logic/`      | 良好     | 纯函数，接受 domain 类型                                           |
| `content/`    | —        | 纯 I/O，无测试价值（需集成测试）                                   |
| `bundle/`     | 差       | 依赖 I/O + EventEmitter + 异步 debounce，难以单元测试              |
| `interface/`  | 差       | God Object，依赖所有层                                             |
