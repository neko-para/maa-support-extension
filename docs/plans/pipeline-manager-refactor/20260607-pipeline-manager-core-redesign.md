# Pipeline Manager — 核心重构方案

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 目标

1. **解除 Node.js 耦合**（TODO-22）——使纯逻辑层可在 browser 环境使用
2. **消除事件驱动强制**（TODO-24）——提供同步/查询式 API，服务 checker 场景
3. **重新设计模块边界**——分离 I/O、编排、纯逻辑三层

## 核心原则

### 原则 1：纯逻辑零依赖

Parser、Diagnostic、Layer（数据模型部分）、Logic 不得依赖 `node:*` 或任何平台特定 API。`path` 操作通过注入或品牌化类型封装。

### 原则 2：数据与 I/O 分离

所有接受文件路径并返回解析结果的 API 应拆分为两步：

1. 纯函数：`parse(source: string) → Result`
2. I/O 适配：调用方自行读取文件，传入 source

库提供 I/O 适配器作为**可选模块**（子路径导出），不强制引入。

### 原则 3：查询优于事件

核心 API 设计为同步/异步查询式。事件驱动作为**可选编排层**，仅 extension 侧使用。Checker 可以直接调用查询 API 获取一次性结果。

## 目标架构

```
┌─ @nekosu/maa-pipeline-manager ─────────────────────┐
│                                                      │
│  ┌─ core/ (纯逻辑，零平台依赖) ──────────────────┐   │
│  │  parser/        AST → 符号图                  │   │
│  │  types/         所有类型定义                   │   │
│  │  matching/      符号匹配 (decl↔ref)           │   │
│  │  diagnostic/    完整性检查                     │   │
│  │  query/         数据查询 (task info, hover)   │   │
│  │  eval/          任务求值                       │   │
│  │  model/         数据模型 (LayerInfo 拆分)     │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ io/ (可选，Node.js 适配) ────────────────────┐   │
│  │  fs-loader.ts    FsContentLoader               │   │
│  │  fs-watcher.ts   FsContentWatcher              │   │
│  │  fs-sync.ts      同步加载 + 解析               │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ orchestration/ (可选，事件驱动编排) ────────┐    │
│  │  bundle.ts       Bundle (事件驱动)             │   │
│  │  manager.ts      BundleManager                 │   │
│  │  interface.ts    InterfaceBundle               │   │
│  │  language.ts     LanguageBundle                │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  导出：                                              │
│  @nekosu/maa-pipeline-manager       → core/          │
│  @nekosu/maa-pipeline-manager/io    → io/            │
│  @nekosu/maa-pipeline-manager/live  → orchestration/ │
└──────────────────────────────────────────────────────┘
```

### 子路径导出

| 子路径                              | 内容                        | 适用场景                        |
| ----------------------------------- | --------------------------- | ------------------------------- |
| `@nekosu/maa-pipeline-manager`      | `core/` — 纯逻辑            | browser, checker 核心逻辑, 测试 |
| `@nekosu/maa-pipeline-manager/io`   | `io/` — Node.js I/O         | checker 完整流程                |
| `@nekosu/maa-pipeline-manager/live` | `orchestration/` — 事件驱动 | extension 实时监视              |

## 模块重设计

### core/model/ — 数据模型

将 `LayerInfo` 拆分为更聚焦的组件：

```
model/
├── task-store.ts      # TaskStore: tasks 增删查，不含求值
├── layer.ts           # Layer: 单层数据容器 (store + parent)
├── layer-tree.ts      # LayerTree: 多层遍历 (mergedDecls, getTask)
├── decl-ref.ts        # DeclInfo / RefInfo 类型 (从 parser 移入)
└── index.ts
```

**TaskStore** — 替代 `LayerInfo.tasks` 的操作：

```typescript
class TaskStore {
  add(name: TaskName, info: LayerTaskInfo): void
  remove(name: TaskName): void
  removeFile(file: AbsolutePath): string[]
  get(name: TaskName): LayerTaskInfo[]
  list(): TaskName[]
}
```

**Layer** — 单层容器，不再依赖 `IContentLoader`：

```typescript
class Layer {
  root: AbsolutePath
  tasks: TaskStore
  images: Set<ImageRelativePath>
  parent?: Layer
}
```

**LayerTree** — 递归查询，从 `LayerInfo` 中提取：

```typescript
class LayerTree {
  constructor(root: Layer)

  getTaskList(): TaskName[]
  getAnchorList(): [AnchorName, TaskAnchorDeclInfo][]
  getTask(name: TaskName): { layer: Layer; infos: LayerTaskInfo[] }[]
  getTaskBriefInfo(name: TaskName): TaskBriefInfo
  mergedDecls(): TaskDeclInfo[]
  mergedRefs(): TaskRefInfo[]
}
```

### core/matching/ — 符号匹配

将当前 LSP 侧 `base.ts` 中的 `makeDecls`/`makeRefs`/`extractTaskRef`/`isAnchorRef` 移入：

```
matching/
├── task-ref.ts        # extractTaskRef, isAnchorRef, findTaskRef
├── decl-match.ts      # findMatchingDecls (← makeDecls)
├── ref-match.ts       # findMatchingRefs (← makeRefs)
└── index.ts
```

这些函数接受 `TaskDeclInfo[]` + `TaskRefInfo[]`，返回匹配结果。不依赖 VSCode API，可在 checker 侧复用。

### core/query/ — 数据查询

将当前 LSP 侧的 hover/document 构建逻辑中不依赖 VSCode 的部分移入：

```
query/
├── task-info.ts       # getTaskBrief, getTaskHover (纯文本部分)
├── image-info.ts      # getImageInfo (不含文件系统访问)
├── locale-info.ts     # getLocaleValue (按 key 查询翻译)
└── index.ts
```

返回结构化数据，由 LSP 侧负责渲染为 Markdown/Range。

### core/eval/ — 任务求值

从 `LayerInfo.evalTask` 和 `InterfaceBundle.evalTask` 中提取纯求值逻辑：

```typescript
function evalTask(
  taskName: TaskName,
  layer: Layer,
  defaultTasks: Record<TaskName, unknown>
): Record<string, unknown>
```

不依赖 `this` 或外部状态，仅操作传入的数据。

### io/ — I/O 适配器

保持现有 `IContentLoader`/`IContentWatcher` 接口，但放在独立的 `io/` 子路径：

```
io/
├── loader.ts          # IContentLoader + FsContentLoader
├── watcher.ts         # IContentWatcher + FsContentWatcher
├── sync.ts            # loadAndParse() —— checker 友好的同步加载
└── index.ts
```

新增 `loadAndParse()`：

```typescript
async function loadAndParse(
  root: string,
  file: string
): Promise<{
  node: Node
  info: InterfaceInfo | TaskInfo
}>
```

封装"读取文件 → 解析 → 返回结果"的常见模式，消除 checker 侧手动管理 watcher 的需求。

### orchestration/ — 事件驱动编排

保持现有 `Bundle`/`BundleManager`/`InterfaceBundle`/`LanguageBundle` 结构，但：

- 从 core 导入纯逻辑
- 使用 io 的 I/O 接口
- 事件驱动作为**可选编排策略**，不影响 core 的独立性

## LayerInfo 拆分对照

| 当前 LayerInfo                                         | 重构后归属                                              |
| ------------------------------------------------------ | ------------------------------------------------------- |
| `tasks` 存储 + 增删                                    | `model/TaskStore`                                       |
| `images` 集合                                          | 保留为 `Set<ImageRelativePath>`（直接操作，无封装价值） |
| `parent` 链                                            | `model/Layer`                                           |
| `mergedDecls` / `mergedRefs` (缓存)                    | `model/LayerTree`                                       |
| `getTaskList()` / `getAnchorList()` / `getImageList()` | `model/LayerTree`                                       |
| `getTask()` (含 MAA trace)                             | `model/LayerTree`                                       |
| `evalTask()`                                           | `eval/eval-task.ts`                                     |
| `getTaskBriefInfo()`                                   | `query/task-info.ts`                                    |
| `getTaskDoc()`                                         | `query/task-info.ts`                                    |
| `toggleMode()`                                         | 独立 `format/` 或保留在原位                             |
| `maaFindTaskDecl()`                                    | `model/LayerTree`                                       |
| `getImage()` / `getImageFolders()`                     | `query/image-info.ts`                                   |

## InterfaceBundle 拆分

| 当前职责                                    | 重构后归属                           |
| ------------------------------------------- | ------------------------------------ |
| 文件监视                                    | `orchestration/` (保留事件驱动)      |
| 解析调度                                    | `orchestration/`                     |
| 数据存储 (info, paths)                      | 提取到独立的 `ProjectState` 数据结构 |
| Bundle 管理                                 | `orchestration/`                     |
| 查询方法 (locateLayer, allLayers, topLayer) | `core/model/LayerTree`               |
| MAA 求值                                    | `core/eval/`                         |

新增 `ProjectState` —— 不依赖 I/O 的纯数据结构：

```typescript
class ProjectState {
  decls: InterfaceDeclInfo[]
  refs: InterfaceRefInfo[]
  layer: Layer
  bundles: Layer[]

  locateLayer(file: AbsolutePath): [Layer, ...]
  allControllerNames(): string[]
  allResourceNames(): string[]
}
```

## 设计原则澄清

### InterfaceBundle 保持为统一入口

`InterfaceBundle` 的设计初衷是匹配 MaaFramework 对 interface.json + resource 体系的定义，作为外部消费者的统一入口。这个定位是正确的，重构后应保持。变化的是**它的内部实现**——从"直接拥有 I/O + 事件 + 数据"变为"组合 core 数据结构 + 注入 I/O 适配器"。

### Layer = 一层 Resource

`Layer` 抽象的是**一层 Resource**，其父子关系对应 MaaFramework 的 resource 覆盖语义。interface.json 自身也是一个 Layer，位于最顶层。这个设计是刻意的，拆分 `LayerInfo` 时不应破坏这个模型。拆分的目标是将**求值逻辑**和**格式转换**从数据层中分离，而非改变 Layer 的 resource 语义。

### 诊断文案完全属于展示层

`diagnostic/` 产生的 `Diagnostic` 类型是纯结构化数据（`type`、`task`、`offset` 等），不包含人类可读的消息文本。`buildDiagnosticMessage()` 应移出 pipeline-manager——文案生成是展示层（LSP/locale）的职责。库只提供诊断的**类型定义**和**检测逻辑**。

## 配置处理重新设计

当前配置相关逻辑散落在 `logic/` 和 `interface/interface.ts` 中，缺乏清晰边界。这是 maa-tools 支持后续添加导致的历史问题。

目标设计：

```
logic/
├── config/
│   ├── types.ts        # 用户配置类型 (InterfaceConfig)
│   ├── resolve.ts      # 配置解析: config + interface → 有效选项
│   └── runtime.ts      # 运行时构建: config + interface → RuntimeConfig
└── index.ts
```

`switchActive()` / `updatePaths()` 等当前在 `InterfaceBundle` 中的逻辑迁移到 `logic/config/`，使 `InterfaceBundle` 专注于数据管理和生命周期。

## 合并/查询接口重新梳理

当前 `mergedXXX` 系列函数是基于代码模式提取的，缺乏统一设计。重新梳理后的接口：

```typescript
// LayerQuery — 对单层或多层的查询接口
interface LayerQuery {
  // 单层查询
  decls(): TaskDeclInfo[]
  refs(): TaskRefInfo[]
  taskList(): TaskName[]
  anchorList(): [AnchorName, TaskAnchorDeclInfo][]
  imageList(): ImageRelativePath[]

  // 跨层查询（含 parent 链）
  allDecls(): TaskDeclInfo[]
  allRefs(): TaskRefInfo[]
  allTaskList(): TaskName[]
  allAnchorList(): [AnchorName, TaskAnchorDeclInfo][]

  // 定位查询
  getTask(name: TaskName): { layer: Layer; infos: LayerTaskInfo[] }[]
  getImage(image: ImageRelativePath): { layer: Layer; path: AbsolutePath }[]
}

// LayerTree 实现 LayerQuery，内部处理 parent 链遍历和缓存
class LayerTree implements LayerQuery {
  constructor(root: Layer) { ... }
}
```

关键改进：

1. **统一命名**：`allXxx` = 跨层，不带前缀 = 单层
2. **缓存封装**：`dirty` 标记和懒计算是 `LayerTree` 的内部实现细节
3. **明确接口**：外部通过 `LayerQuery` 接口消费，不直接操作 `mergedDeclsCache` 等内部状态

## TODO-23 注意事项

已知罕见 Bug——插件和 checker 同时执行时有概率错误删除图片文件。代码层面无删除操作，怀疑与 watch 库有关。

重构中需注意：

- IO 分离时，`FsContentWatcher` 保持现有 chokidar 配置不变（Phase 2 之前不修改 watcher 实现）
- Orchestration 层重构时保留现有的 debounce 和事件合并逻辑
- 如果 Phase 3/4 中替换 watcher 实现，需进行并发压力测试

## LSP 独立进程预规划

> ⚠️ 此项为远期目标，不作为本次重构的关键目标。

### 动机

当前 LSP 能力嵌入 VSCode 插件内部。考虑将 LSP 实现为独立进程（Language Server Protocol），可以：

- 被其他编辑器复用（非 VSCode 环境）
- 独立于插件的控制面板生命周期
- 更好的性能隔离

### 挑战

控制面板（Control Panel）管理着"激活的控制器"和"激活的资源"等运行时状态。如果 LSP 在独立进程中，这些状态需要跨进程共享：

- 当前：插件内存 → Provider 直接读取
- 独立进程：插件内存 → IPC → LSP 进程

### 预规划方向

1. **状态外部化**：将 `activeController`、`activeResource` 等运行时状态从 `InterfaceBundle` 中分离为独立的 `ProjectSession` 对象
2. **LSP 请求模型**：LSP 的 `initialize` / `didChangeConfiguration` 等协议可以传递会话状态，替代当前的直接内存访问
3. **共享数据结构**：`ProjectState`（纯数据）可以在进程间序列化传输，`ProjectSession`（运行时状态）通过配置变更通知同步

本次重构中可做的准备：

- 在 `InterfaceBundle` 拆分时，将"运行时状态"（activeController/activeResource）与"持久数据"（decls/refs/layer）明确分离
- `ProjectState` 设计为可序列化的纯数据结构
- 避免在 core 逻辑中引入对 VSCode 或进程内状态的隐式依赖

## 实施阶段

### Phase 1：提取纯逻辑（无破坏性变更）

1. 创建 `core/` 目录结构
2. 将 `parser/`、`utils/helper.ts`、`utils/types.ts` 移入 core（解耦 `path` 依赖）
3. 将 `diagnostic/` 移入 core
4. 拆分 `LayerInfo` → `TaskStore` + `Layer` + `LayerTree`（images 保留为 `Set`）
5. 提取 `evalTask` 为独立函数
6. 从 `base.ts` 提取 `makeDecls`/`makeRefs`/`extractTaskRef` 到 `core/matching/`
7. 旧模块保持兼容（通过 re-export 或 delegating wrapper）

### Phase 2：IO 分离

1. 创建 `io/` 子路径
2. 移入 `content/` 模块
3. 实现 `loadAndParse()` 同步式 API
4. 现有 consumers 逐步迁移到新导入路径

### Phase 3：编排可选化

1. 创建 `orchestration/` 子路径
2. 移入 `bundle/`、`interface/` 的事件驱动模块
3. 重构 `InterfaceBundle` 为 `ProjectState` + 事件编排的组合
4. Extension 侧迁移到 `@nekosu/maa-pipeline-manager/live`
5. Checker 侧迁移到纯 core + io 路径

### Phase 4：清理

1. 移除旧模块的兼容层
2. 更新文档
3. 更新外部使用者（maa-tools 的 pm 子路径导出）

## 模块拆分分析

当前模块规模不均——前 5 个文件占代码量的 31%。这些文件并非因为有 5 个独立的"大模块"，而是内容随时间堆叠导致的。以下是拆分建议：

### 需要拆分的模块

| 当前文件                 | 行数 | 问题                                                                       | 拆分方向                                                                                                              |
| ------------------------ | ---- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `interface/interface.ts` | 417  | God Object：事件编排 + 数据容器 + 配置管理 + 查询                          | → `orchestration/interface-bundle.ts`（编排）+ `core/model/project-state.ts`（数据）+ `core/config/`（配置）          |
| `layer/layer.ts`         | 397  | 数据模型 + 求值 + 格式转换混在一起                                         | → `core/model/task-store.ts` + `core/model/layer.ts` + `core/model/layer-tree.ts` + `core/eval/`                      |
| `parser/task/task.ts`    | 351  | `parseTask()` 入口 + `buildTaskRef()` + `processCustom()` 各属于不同关注点 | → `parser/task/parse.ts`（入口）+ `parser/task/maa-ref.ts`（`buildTaskRef`）+ `parser/task/custom.ts`（自定义解析器） |

### 可拆但不急的模块

| 当前文件                        | 行数 | 拆分方向                                                                                                          |
| ------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------- |
| `diagnostic/interface.ts`       | 326  | 按诊断类型拆分为 controller / resource / option / preset 等子模块                                                 |
| `diagnostic/task.ts`            | 271  | 按诊断类型拆分（conflict / unknown-task / image 等）                                                              |
| `parser/interface/interface.ts` | 265  | 当前已按 section 拆分（controller / resource / task），但入口文件仍较大。考虑保留现状，仅在与 core 重构冲突时调整 |

### 不建议拆分的模块

| 文件                           | 理由                                                                  |
| ------------------------------ | --------------------------------------------------------------------- |
| `parser/task/types.ts` (196行) | 类型定义集中管理比分散到各文件更易维护                                |
| `parser/task/keys.ts` (133行)  | 6 个 key 数组是同一关注点（属性分类），拆分无收益                     |
| `logic/runtime/` 系列          | 已有良好分离（controller / resource / option / task），无需进一步拆分 |
| `content/` 系列                | I/O 层本身体量小，且将在 io 子路径中保持独立                          |

### 拆分原则

1. **按职责而非按行数**：拆分依据是"这个模块承担了几种不同职责"，而不是"这个文件超过 X 行"
2. **类型定义集中**：类型分散到多个文件会增加 import 复杂度和循环依赖风险，应保持 `types.ts` 集中
3. **拆分后每个文件有单一职责**：例如 `task-store.ts` 仅负责增删查，`eval-task.ts` 仅负责求值

## NPM 包拆分分析

### 是否拆分为多个 npm 包？

当前方案使用**子路径导出**（`/io`、`/live`）而非独立 npm 包。分析如下：

#### 方案 A：保持单包 + 子路径导出（当前方案）

```
@nekosu/maa-pipeline-manager           → core/
@nekosu/maa-pipeline-manager/io        → io/
@nekosu/maa-pipeline-manager/live      → orchestration/
```

- **优点**：单一版本号、类型定义共享无延迟、发布简单
- **缺点**：`io/` 的 `chokidar` 依赖必须声明在 `package.json` 中（即使 core 使用者不需要），尽管 npm 的 `optionalDependencies` 和 tree-shaking 可缓解

#### 方案 B：拆分为三个独立包

```
@nekosu/maa-pipeline-core          → core/ (零 Node 依赖，browser 可用)
@nekosu/maa-pipeline-io            → io/ (依赖 core + chokidar)
@nekosu/maa-pipeline-live          → orchestration/ (依赖 core + io)
```

- **优点**：依赖完全隔离（browser 使用者不安装 chokidar）、每个包的职责边界强制清晰
- **缺点**：版本同步负担 × 3（TODO-6 已是一个痛点）、类型变更需跨包协调发布、引入成本增加

#### 建议：保持方案 A

理由：

1. **当前无 browser 使用者**——虽然 TODO-22 要求解除 Node 耦合，但实际消费者（extension、maa-tools）都在 Node 环境。单包子路径已能解决 checker 侧"不想要事件驱动"的问题。
2. **npm `optionalDependencies` 可处理 chokidar**——core 使用者不安装 `chokidar` 不会导致安装失败（标记为 optional）。
3. **版本同步成本**——如 TODO-6 所述，多包手动升版已是痛点。增加包数会恶化此问题。
4. **未来可拆**——如果出现真实的 browser 使用者或第三方只想要 core，届时拆包是纯机械操作（移文件 + 调整 package.json），不影响 API 设计。

### 依赖声明策略

```jsonc
// package.json
{
  "dependencies": {
    // core 依赖 — 所有使用者都需要
  },
  "optionalDependencies": {
    "chokidar": "..." // 仅 io/ 使用者需要
  },
  "peerDependencies": {
    "@nekosu/maa-tasker": "..." // 仅 MAA 模式需要
  }
}
```

## MaaFramework / MAA 双模式处理

### 产品形态理解

MaaFramework 和 MAA 是**两套独立的 pipeline 语法**，彼此无依赖、不混合：

- **MaaFramework**：需同时支持 V1（平铺属性）和 V2（`recognition`/`action` 嵌套对象），未来可能新增 V3。版本之间可共存于同一 pipeline 文件。
- **MAA**：独立项目，有自己的 `baseTask` 继承机制和 `@` 表达式。与 MaaFramework 语法完全隔离。

当前通过 `maa: boolean` 标志区分，这是历史添加的，未经仔细设计。重构目标是取消这个标志，改为**结构化分离**。

### 差异点全景

| 差异维度            | MaaFramework                                          | MAA (🄼)                                                      |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| **属性分类**        | `nodeKeys` / `recoKeys` / `actKeys` + V2 嵌套格式检测 | `maaNodeKeys` / `maaRecoKeys` / `maaActKeys`                 |
| **算法/动作字段名** | `recognition` / `action`                              | `algorithm` / `action`                                       |
| **目录约定**        | `pipeline/` / `image/`                                | `tasks/` / `template/`                                       |
| **任务名格式**      | 扁平                                                  | 带 `@` 后缀：`TaskA@TaskB`                                   |
| **任务引用**        | `next` / `on_error`                                   | `baseTask`（继承）+ 表达式（`sub`/`next`/`exceededNext` 等） |
| **@ 表达式**        | 不存在                                                | 存在，依赖 `@nekosu/maa-tasker`                              |
| **图片路径匹配**    | 精确匹配                                              | 后缀匹配                                                     |
| **任务查找**        | 按名精确匹配                                          | `@` 后缀追踪                                                 |

### 重构方向：结构化分离

取消 `maa: boolean` 标志。允许为 MAA 抽出**独立的类/模块**来实现其特化逻辑，即使这意味着与 MaaFramework 的代码有部分重复。

```
core/
├── parser/task/
│   ├── fw/
│   │   ├── split.ts          # MaaFramework 属性分类（含 V1/V2 检测）
│   │   ├── parse.ts          # MaaFramework parseTask()
│   │   └── keys.ts           # nodeKeys / recoKeys / actKeys
│   └── maa/
│       ├── split.ts          # MAA 属性分类（maaNodeKeys 等）
│       ├── parse.ts          # MAA parseTask()（含 baseTask/expr）
│       ├── keys.ts           # maaNodeKeys / maaRecoKeys / maaActKeys
│       ├── baseTask.ts       # baseTask 引用解析
│       ├── expr.ts           # @ 表达式解析
│       └── ref.ts            # buildTaskRef — @ 后缀追踪
```

**设计要点**：

1. **两种 parseTask 各自独立**——不共享内部实现，仅共享通用的 AST 工具（`parseObject`、`isString` 等）。MAA 版本内部调用 `parseMaaBaseTask` / `parseMaaExpr`，MaaFramework 版本内部调用 `parseNext` / `parseTarget`。

2. **共享的类型定义**——`TaskDeclInfo`、`TaskRefInfo` 等类型是两个 parser 的**共同输出格式**，保持在 `parser/task/types.ts` 中不变。MAA 的 `task.maa.base_task` / `task.maa.expr` 是这套类型中的扩展变体。

3. **MaaFramework V1/V2 兼容**——V1 和 V2 是同一套语法的两种格式，在 `fw/split.ts` 内部处理，外部不感知。`splitNode()` 自动检测 `recognition`/`action` 是字符串（V1）还是对象（V2）。

4. **Layer 层的差异**——`LayerInfo` 改为不感知 MAA/MaaFramework。特化逻辑（`@` 后缀追踪、图片后缀匹配）移到 `core/model/` 的对应查询方法中，但通过**方法重载**或**独立子类**区分：
   - `LayerTree.getTask(name)` — 通用实现（精确匹配）
   - 需要 MAA 行为时，构造时传入配置，或使用独立查询函数 `findTaskBySuffix(layer, name)`

### core 层对 `@nekosu/maa-tasker` 的依赖

`@nekosu/maa-tasker` 仅被 `parser/task/maa/expr.ts` 使用。重构后 core 主路径（`@nekosu/maa-pipeline-manager`）不依赖 `maa-tasker`。需要 MAA 支持时，通过以下方式之一获取：

- 显式导入 `@nekosu/maa-pipeline-manager/maa` 子路径（如需完整 MAA 解析能力）
- 在 LSP/checker 侧组合使用（与 MaaFramework 解析器并列）

### 策略模式评估结论

> **不使用策略模式（`PipelineMode`）。** 理由：
>
> 1. MaaFramework 和 MAA 不存在组合/混合——始终只有一种模式生效
> 2. 两个模式的行为差异远大于共性——`splitNode`、`parseTask`、`getTask`、`getImage` 的差异需要独立实现，仅靠配置对象无法覆盖
> 3. MaaFramework V1/V2 的共存关系与 MAA 的独立关系性质不同——V1/V2 是 MaaFramework 内部的格式变体，MAA 是完全独立的语法体系

## 风险与约束

- **MAA 模式**：本次重构通过结构化分离取消 `maa: boolean` 标志，MAA 独有逻辑抽取为独立模块（`parser/task/maa/`）。core 主路径不依赖 `@nekosu/maa-tasker`。
- **外部使用者**：`@nekosu/maa-pipeline-manager/pm` 子路径由 maa-tools 导出给外部。需要维护向后兼容或提前沟通
- **`buildTree` 位置信息丢失**：TODO-28 已确认是有意设计，本次不改
- **`toggleMode`**：实验性功能，可延后处理或标记 deprecated
