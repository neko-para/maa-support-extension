# Maa Pipeline Manager 重写方案

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 目标

重写 `@nekosu/maa-pipeline-manager`，解决当前架构的核心问题：

1. **[TODO#24] 事件驱动模型 → 查询驱动模型**：移除 EventEmitter 链，改为 Snapshot 模式
2. **[TODO#22] Node.js API 耦合**：核心模块不依赖 `node:path`、`node:events`、`node:fs`；I/O 完全通过接口注入
3. **支持测试**：核心解析/查询/诊断逻辑均为纯函数，可脱离文件系统测试

### 开发策略

- **独立新目录开发**：在 `pkgs/` 下新建目录（如 `pkgs/maa-pipeline-vNext/`），所有新代码在新目录中开发，不修改现有 `pkgs/maa-pipeline-manager/` 的任何文件
- **完成后再替换**：新包所有 Phase 开发 + 测试完成后，删除旧 `pkgs/maa-pipeline-manager/`，将新目录重命名替换
- **大版本号**：包版本从 `1.x` 升至 `2.0.0`，明确标注 breaking change
- **Consumer 同步更新**：`@mse/extension` 和 `@nekosu/maa-tools` 在替换阶段同步适配新 API

本次为**重写**，不保证向后兼容。重写后同步更新 consumer（`@mse/extension`、`@nekosu/maa-tools`）。

## 参考

### MaaFramework 官方协议

本库处理的核心数据格式由 MaaFramework 官方定义：

- **[任务流水线协议](https://github.com/MaaXYZ/MaaFramework/blob/main/docs/zh_cn/3.1-%E4%BB%BB%E5%8A%A1%E6%B5%81%E6%B0%B4%E7%BA%BF%E5%8D%8F%E8%AE%AE.md)**：定义 pipeline JSON 的节点结构（recognition、action、next、on_error、roi、template 等）及执行语义
- **[ProjectInterface V2 协议](https://github.com/MaaXYZ/MaaFramework/blob/main/docs/zh_cn/3.3-ProjectInterfaceV2%E5%8D%8F%E8%AE%AE.md)**：定义 `interface.json` 的结构（controller、resource、task、option、preset、group、import 等）

### 官方协议的关键概念

- **Pipeline Node（节点/任务）**：pipeline JSON 的顶层 key，代表一个可执行的识别-动作单元
- **next 列表**：节点的后继节点引用，按顺序尝试识别。支持普通节点名、`[Anchor]锚点名`、`[JumpBack]节点名` 三种形式
- **Anchor（锚点）**：节点可通过 `anchor` 字段声明自己为锚点，其他节点的 `next`/`on_error` 可通过 `[Anchor]` 前缀引用
- **default_pipeline.json**：放在资源包根目录，为所有节点提供默认值。优先级：节点自身 → 算法/动作类型默认值 → Default 对象 → 框架内置值
- **Pipeline v1 / v2**：v1 中 `recognition`/`action` 是字符串，v2 中扩展为 `{type, param}` 对象。两种格式可混合
- **Bundle（资源包）**：一个包含 `pipeline/`（或 MAA 模式的 `tasks/`）、`image/`（或 `template/`）、`model/` 的目录。多个 Bundle 按加载顺序叠加
- **Resource Override（资源覆盖）**：后加载的 Bundle 中的同名字段覆盖先加载的
- **ProjectInterface**：项目的集成配置，声明 controller、resource、task、option，以及 `pipeline_override`（通过选项/预设动态修改 pipeline 节点参数）

### 当前代码与官方概念的命名对照

| 官方概念 | 当前代码 | 问题 |
|---------|---------|------|
| Bundle（资源包目录，含 pipeline/ + image/ + model/ + default_pipeline.json） | `Bundle` class | 名字正确，但职责过重（文件监视 + JSON 解析 + 事件发射混合） |
| 多 Bundle 按顺序叠加（后加载覆盖先加载） | `LayerInfo` + `parent` 链 | **"Layer" 是自定义命名**，官方无此术语。本质 = 一个 Bundle 加载后的数据集 |
| `resource[].path`（资源路径数组） | `InterfaceBundle.paths` → 创建 `Bundle[]` | 每个 path 映射到一个 Bundle 实例 |
| `default_pipeline.json` 继承优先级 | `LayerInfo.evalTask()` 中 $Default/reco/act 合并 | 部分实现，逻辑分散 |

**结论**：当前代码的 "Layer" 就是官方 Bundle 概念的数据面。重写时统一命名为 **Bundle**——一个 Bundle = 一个资源目录加载后的完整数据集，多个 Bundle 按 `resource[].path` 顺序构成层级叠加。

> 以下为当前代码中其他的自定义抽象。

- **mergedDecls / mergedRefs**：Bundle 的"脏标记缓存"机制——将当前 Bundle 和所有父 Bundle 的声明/引用合并到一起，在 dirty 时重新计算。重写后由 Snapshot 的不可变更新替代（无缓存失效问题）。
- **InterfaceBundle**：当前代码的中央调度器——管理 interface.json 的加载/监视、所有 Bundle 的创建/销毁、active controller/resource 切换、LanguageBundle 管理、MAA 表达式求值。对应官方协议中"Client 加载 PI 并管理资源"的角色。重写后拆分为 Project（编排） + Snapshot（数据）。

## 现状问题分析

### 问题 1：事件驱动的复杂性

当前事件链（以 InterfaceBundle 为核心）：

```
interfaceChanged ──→ updatePaths() ──→ pathChanged ──→ bundle.load() ──→ bundleReloaded
                  ├→ updateLangs() ──→ localeChanged
                  └→ updateImports() ──→ importChanged ──→ import.load()

activeChanged ──→ updatePaths() ──→ ...
```

8 种事件类型，内部事件链互相触发。CLI checker 需要的是"加载完所有文件后的一次性结果"，但当前 API 强迫它订阅事件、等待 flush 完成、手动追踪状态。

### 问题 2：Node.js 深层耦合

| 依赖 | 使用位置 | 说明 |
|------|---------|------|
| `node:events` | Bundle, InterfaceBundle, LanguageBundle | EventEmitter 继承 |
| `node:path` | bundle.ts, interface.ts, layer.ts, utils/types.ts（旧代码） | `path.join`, `path.relative`, `path.sep`, `path.normalize`, `path.basename`, `path.dirname` |
| `node:fs/promises` | content/loader.ts | FsContentLoader |
| `chokidar` | content/watch.ts | FsContentWatcher |
| `setTimeout` / `process.nextTick` | bundle/manager.ts, content/json.ts | Debounce 逻辑 |

`IContentLoader` / `IContentWatcher` 接口虽然存在，但核心模块（Bundle、InterfaceBundle、LayerInfo）仍直接依赖 `node:path`，导致无法在 browser 环境运行。

### 问题 3：职责混合

- **Bundle**：同时做文件过滤、JSON 解析、task 加载、image 追踪、事件发射
- **InterfaceBundle**：同时做 interface 解析、Bundle 生命周期管理、LanguageBundle 管理、MAA 求值、active 状态管理
- **LayerInfo**：同时做 task 存储、跨层合并缓存、配置求值（evalTask）、格式切换（toggleMode）
- **ContentJson**：同时做 JSON 加载、文件监视、debounce、回调触发

### 问题 4：缺少测试

整个包无测试目录、无测试脚本。核心解析逻辑与文件 I/O 紧耦合，无法脱离文件系统单独测试。

### 问题 5：全量合并视图，缺少分层查询 API

当前 `LayerInfo` 只暴露一个"全量打平"视图——`mergedDecls` / `mergedRefs` 将所有 Bundle、所有文件的声明/引用合并为一个数组，consumer 被迫自己做 O(n) 遍历：

```typescript
// 随处可见的 pattern：
layer.mergedDecls.filter(decl => decl.file === file)   // 只要当前文件的声明
layer.mergedRefs.filter(ref => ref.file === file)       // 只要当前文件的引用
layer.mergedDecls.find(decl => decl.type === 'task.anchor' && decl.anchor === name) // 按条件查找
```

该有的查询 API 不存在。而底层数据模型本身是正确的——`Record<TaskName, LayerTaskInfo[]>` 数组按解析顺序排列，jsonc-parser 保留所有 key（含重复），数据零丢失。

**根本原因**：`mergedDecls`/`mergedRefs` 试图用一个数据结构服务两种互斥的需求：

| 需求 | 需要的数据 | 使用场景 |
|------|-----------|---------|
| **单文件视图**：这个文件里有哪些声明/引用？ | 当前文件 | Completion, Hover, Definition（当前文件侧） |
| **全局视图**：是否存在任务 X？引用 Y 是否合法？ | 跨文件、跨 Bundle | Diagnostics, Task 补全列表, Definition 跳转 |

当前设计只提供全局视图，缺少单文件视图。重写时应显式区分两种查询入口。

## 新架构设计

### 核心原则

1. **核心纯函数，I/O 可注入**：解析、查询、诊断等核心逻辑不依赖任何平台 API
2. **Snapshot 模式**：所有加载完成后的数据组织为不可变快照，消费者通过查询方法获取所需信息
3. **关注点分离**：解析、存储、查询、诊断、I/O、编排各自独立

### 模块划分

```
src/
├── index.ts                    # 公共 API 入口
├── types.ts                    # 品牌化类型（不依赖 node:path）
│
├── path/                       # 【新】路径工具抽象
│   ├── interface.ts            # IPathUtils 接口
│   └── node.ts                 # NodePathUtils（node:path 实现）
│
├── pipeline/                   # 【重写】Pipeline 解析（纯函数）
│   ├── types.ts                # 节点类型、引用类型、声明类型
│   ├── parser.ts               # parsePipeline(json, context) → ParsedTask
│   ├── v1v2.ts                 # Pipeline v1 ↔ v2 格式规范化
│   └── default-pipeline.ts     # default_pipeline.json 解析与合并
│
├── interface/                  # 【重写】Interface 解析（纯函数）
│   ├── types.ts                # Interface 类型定义
│   ├── parser.ts               # parseInterface(json) → ParsedInterface
│   └── merge.ts                # Import 合并逻辑
│
├── snapshot/                   # 【新】数据快照（查询驱动核心）
│   ├── file-view.ts            # FileView：单文件视图（不合并）
│   ├── bundle-view.ts          # BundleView：一个资源目录（文件集合 + 图像集合 + 默认配置）
│   ├── snapshot.ts             # ResourceSnapshot：跨 Bundle 全局视图 + 不可变数据集合
│   └── completions.ts          # 补全项生成（纯函数）
│
├── diagnostic/                 # 【重写】诊断引擎（纯函数）
│   ├── types.ts                # Diagnostic 类型（保持现有 ~25 种）
│   ├── pipeline.ts             # checkPipeline(snapshot) → Diagnostic[]
│   ├── interface.ts            # checkInterface(snapshot) → Diagnostic[]
│   ├── message.ts              # buildDiagnosticMessage()（i18n 格式化）
│   └── index.ts                # performDiagnostic(snapshot, options) → Diagnostic[]
│
├── runtime/                    # 【保留·重构】运行时配置构建（纯函数）
│   ├── types.ts                # 运行时类型
│   ├── validate.ts             # validateControllerConfig() — 纯验证，无 maa 依赖（webview 安全）
│   ├── controller.ts           # buildControllerRuntime() — 完整构建（extension 使用）
│   ├── resource.ts             # buildResourceRuntime()
│   ├── option.ts               # buildOption() — 选项依赖链解析
│   ├── task.ts                 # buildTaskRuntime()
│   └── override.ts             # pipeline_override 合并逻辑
│
├── io/                         # 【重写】I/O 抽象层
│   ├── loader.ts               # IContentLoader 接口（保持现有定义）
│   ├── watcher.ts              # IContentWatcher 接口（保持现有定义）
│   └── fs/                     # Node.js 实现
│       ├── loader.ts           # FsContentLoader（移动自 content/loader.ts）
│       └── watcher.ts          # FsContentWatcher（移动自 content/watch.ts）
│
├── project/                    # 【新】项目编排层
│   ├── project.ts              # Project：管理资源加载、active 状态、Snapshot 生成
│   └── watcher.ts              # FileWatcher：可选的文件监视集成
│
└── utils/                      # 【保留·清理】纯工具函数
    ├── json.ts                 # JSONC 树操作（buildTree, parseTreeWithoutParent）
    └── helper.ts               # 引用查找辅助（findDeclRef, extractTaskRef, isAnchorRef）
```

### 数据模型：三层视图

Snapshot 的核心设计原则：**数据存储原样保留（按解析顺序），查询 API 按维度分层**。

```
┌─────────────────────────────────────────────────────┐
│ ResourceSnapshot（跨 Bundle 全局视图）               │
│   resolveTask(), allTasks(), diagnose()...          │
│                                                     │
│   ┌─────────────────────────────────────────────┐  │
│   │ BundleView（一个资源目录）                     │  │
│   │   root, defaultConfig                         │  │
│   │   images: Set<ImageRelativePath>  ← Bundle级  │  │
│   │                                               │  │
│   │   ┌───────────────────────────────────────┐  │  │
│   │   │ FileView（一个 pipeline JSON 文件）     │  │  │
│   │   │   path                                  │  │  │
│   │   │   tasks: Map<TaskName, TaskEntry[]>     │  │  │
│   │   │   decls, refs（仅该文件内）              │  │  │
│   │   └───────────────────────────────────────┘  │  │
│   │   ...多个 FileView                           │  │
│   └─────────────────────────────────────────────┘  │
│   ...多个 BundleView（按 resource[].path 顺序）      │
└─────────────────────────────────────────────────────┘
```

#### FileView：单文件视图

Consumer 不再需要 `mergedDecls.filter(d => d.file === file)`。

```typescript
class FileView {
  readonly path: AbsolutePath
  /** 该文件中定义的任务。key 为任务名，value 为按出现顺序的条目数组（含重复 key） */
  readonly tasks: ReadonlyMap<TaskName, TaskEntry[]>
  /** 该文件内的声明（仅此文件） */
  readonly decls: readonly TaskDeclInfo[]
  /** 该文件内的引用（仅此文件） */
  readonly refs: readonly TaskRefInfo[]
}
```

#### BundleView：一个资源目录

```typescript
class BundleView {
  readonly root: AbsolutePath
  readonly files: ReadonlyMap<RelativePath, FileView>
  /** 图像文件集合——属于 Bundle 目录，不属于任何 pipeline JSON 文件 */
  readonly images: ReadonlySet<ImageRelativePath>
  readonly defaultConfig: DefaultConfig | null

  /** Bundle 内解析后的任务——同文件后出现覆盖前者，跨文件后 parse 的覆盖先 parse 的 */
  resolveTask(name: TaskName): TaskEntry | null
  /** 所有声明（跨文件合并），带源文件标注 */
  allDecls(): DeclInFile[]
  /** 所有引用（跨文件合并），带源文件标注 */
  allRefs(): RefInFile[]
  /** 图像文件夹（用于 template 文件夹引用） */
  getImageFolders(): Map<ImageRelativePath, BundleView[]>
}
```

关键：`images` 不在 `FileView` 中——图像是 Bundle 目录下的 `.png` 实体，pipeline JSON 通过 `template` 字段**引用**它们。图像存在性和引用合法性是两个独立的查询维度，后者由 diagnostic 验证。

#### ResourceSnapshot：跨 Bundle 全局视图

```typescript
class ResourceSnapshot {
  /** Bundle 列表，按 interface.json 中 resource[].path 顺序 */
  readonly bundles: readonly BundleView[]
  readonly interface: ParsedInterface | null
  readonly languages: readonly LanguageInfo[]

  // ── 单文件视图（不合并）──
  /** 定位文件所属的 Bundle 和 FileView */
  locateBundle(path: AbsolutePath): { bundle: BundleView; file: FileView } | null

  // ── 全局视图（跨 Bundle 解析）──
  /** 解析任务——沿 Bundle 链从后向前，后者覆盖前者 */
  resolveTask(name: TaskName): TaskEntry | null
  /** 所有任务名（去重，用于补全列表） */
  listTasks(): TaskName[]
  /** 所有声明（含源 Bundle + 源文件标注） */
  allDecls(): DeclWithBundle[]
  /** 所有引用（含源 Bundle + 源文件标注） */
  allRefs(): RefWithBundle[]
  /** 所有图像文件路径（跨 Bundle 去重） */
  listImages(): ImageRelativePath[]
  /** 锚点列表（跨 Bundle） */
  getAnchorList(): [AnchorName, TaskAnchorDeclInfo][]
  /** 图像文件夹（跨 Bundle，用于 template 文件夹引用） */
  getImageFolders(): Map<ImageRelativePath, BundleView[]>
  /** 运行所有诊断 */
  diagnose(options?: DiagnosticOption): Diagnostic[]
  /** 生成补全项 */
  getCompletions(file: AbsolutePath, offset: number): CompletionItem[]
}
```

**Consumer 使用对比**：

```typescript
// 当前（需手动过滤）：
const decls = layer.mergedDecls.filter(decl => decl.file === file)
const refs = layer.mergedRefs.filter(ref => ref.file === file)

// 重写后（直接拿）：
const { file } = snapshot.locateBundle(path)
// file.decls, file.refs, file.tasks — 无需过滤

// 全局查询（走专用方法）：
snapshot.listTasks()       // 不需要从 mergedDecls 中手动提取
snapshot.allDecls()        // 带 source bundle + source file
snapshot.resolveTask(name) // 跨 Bundle 解析，封装覆盖规则
snapshot.diagnose()        // 纯函数，同步返回
```

### 不可变性的定位

Snapshot 的核心价值是**正确性保证 + 测试基础设施**，不是性能优化。

**有实际收益的**：

1. **原子性**：文件变更时，构建新 Snapshot → 成功则 swap，失败则旧 Snapshot 不受影响。当前 `deleteFileImpl` + 重新 parse + `push` 若中途抛异常，LayerInfo 处于半清理状态。
2. **测试**：构造任意 Snapshot 状态不需要文件系统。`Snapshot.empty().withBundle(...)` 直接得到目标状态，然后验证查询/诊断结果。
3. **消除 dirty 缓存**：当前 `markDirty()` + `flushMergedDeclsRefs()` 的惰性求值是常见 bug 来源（改了数据但忘记 markDirty）。Snapshot 在构造时就完成计算，不存在缓存失效。

**没有实际收益的**：

4. **性能**：不会更快。文件级解析本身是瓶颈（需要完整 JSON 文本），不可变包装只是换个方式组织结果。
5. **跨 Bundle 共享引用**：Bundle 数量通常 2-4 个，共享收益很小。
6. **不需要工具库**：写操作极少（`withBundle` 即浅拷贝），手写足够。不引入 immer 或 Immutable.js（TODO#19 的历史教训）。

### Project：编排层

Project 是"如何从文件系统得到一个 Snapshot"的编排器——它是有状态的、异步的，但**只存在于编排层**。

```typescript
class Project {
  readonly pathUtils: IPathUtils
  readonly loader: IContentLoader

  // 当前状态
  currentSnapshot: ResourceSnapshot
  activeController: string
  activeResource: string

  /** 加载 interface.json */
  async loadInterface(file: AbsolutePath): Promise<void>

  /** 切换 active controller/resource */
  async switchActive(controller: string, resource: string): Promise<void>

  /** 获取当前快照 */
  snapshot(): ResourceSnapshot

  /** 强制重新加载（从文件系统重新读取所有文件） */
  async reload(): Promise<void>
}

// 可选：集成文件监视
class WatchedProject extends Project {
  constructor(loader: IContentLoader, watcher: IContentWatcher, root: AbsolutePath) { ... }

  /** 当文件变更时自动更新 snapshot */
  onChange: (snapshot: ResourceSnapshot) => void

  startWatching(): void
  stopWatching(): void
}
```

Consumer 的使用差异：

```typescript
// ── VSCode Extension（需要文件监视）──
const project = new WatchedProject(loader, watcher, root)
await project.loadInterface('interface.json')
project.onChange = (snapshot) => {
  // 文件变更时自动获得新 snapshot，触发 LSP 刷新
  refreshDiagnostics(snapshot.diagnose())
}
await project.switchActive('Win32', 'official')

// ── CLI Checker（只需要一次加载）──
const project = new Project(loader, root)
await project.loadInterface('interface.json')
const snapshot = project.snapshot()
const diags = snapshot.diagnose()
// 用完即弃，无事件、无监视
```

### Node.js 依赖清理策略

| 当前依赖 | 处理方式 |
|---------|---------|
| `node:events` (EventEmitter) | **移除**。Snapshot + onChange 回调替代。编排层仅暴露一个 `onChange` 回调（或 EventEmitter 可选封装）。 |
| `node:path` | **抽象为 `IPathUtils` 接口**。默认实现 `NodePathUtils` 使用 `node:path`。Browser 环境可注入 `BrowserPathUtils`（使用 `/` 分隔符的纯字符串操作）。 |
| `node:fs/promises` | **保留在 `io/fs/loader.ts`**（已有接口隔离）。 |
| `chokidar` | **保留在 `io/fs/watcher.ts`**（已有接口隔离）。只在 `WatchedProject` 中使用。 |
| `setTimeout` / `process.nextTick` | **移到 `project/watcher.ts`**（仅文件监视的 debounce 逻辑使用）。核心模块不使用。 |
| `jsonc-parser` | **保留**（无平台依赖，纯 AST 解析）。 |
| `@nekosu/maa-locale` | **保留**（诊断消息国际化）。 |
| `@nekosu/maa-tasker` | **保留**（MAA 表达式解析，仅在 MAA 模式下使用）。 |

### 路径抽象

`IPathUtils` 接口隔离 `node:path`：

```typescript
interface IPathUtils {
  join(...segments: string[]): string
  relative(from: string, to: string): string
  normalize(p: string): string
  basename(p: string): string
  dirname(p: string): string
  readonly sep: string
}
```

核心模块不再使用品牌化类型包装路径函数（移除当前的 `joinPath`、`relativePath` 等），改为要求调用方注入 `IPathUtils`。

品牌化类型（`TaskName`、`AnchorName`、`ImageRelativePath`、`AbsolutePath`、`RelativePath`）**保留**，但不再包含路径操作方法。

## 实施计划

> 所有开发在独立新目录 `pkgs/maa-pipeline-vNext/` 中进行，不修改现有 `pkgs/maa-pipeline-manager/`。

### Phase 1：基础设施

**产出物**：项目骨架、类型系统、路径抽象、测试框架。

| 任务 | 文件 |
|------|------|
| 初始化新包 `pkgs/maa-pipeline-vNext/`（package.json, tsconfig, vitest.config.ts） | 新目录 |
| 定义品牌化类型（`TaskName`, `AbsolutePath` 等），不含 path 操作 | `src/types.ts` |
| 定义 `IPathUtils` 接口 + `NodePathUtils` 实现 | `src/path/interface.ts`, `src/path/node.ts` |
| 迁移纯工具函数（`parseObject`, `isString`, `buildTree` 等） | `src/utils/json.ts`, `src/utils/helper.ts` |
| 编写空 suite 验证测试框架可运行 | `src/__tests__/` |

### Phase 2：Pipeline 解析器

**产出物**：`parsePipeline()` 纯函数 + 单元测试。**零 I/O 依赖，纯 JSON 字符串输入**。

| 任务 | 说明 |
|------|------|
| 定义 Pipeline 类型（`TaskInfo`, `TaskDeclInfo`, `TaskRefInfo` 等） | 基于 jsonc-parser AST 的类型 |
| `parsePipeline(json, context) → ParsedTask` | 解析单个任务节点的所有属性和子结构 |
| `normalizePipeline(node) → PipelineV2` | v1 格式规范化到 v2 |
| `parseDefaultPipeline(json) → DefaultConfig` | default_pipeline.json 解析 |
| 编写单元测试（fixture JSON 文件） | 覆盖 v1/v2、MAA 语法、重复 key、各识别/动作类型 |

### Phase 3：Interface 解析器

**产出物**：`parseInterface()` 纯函数 + 单元测试。**独立于 Phase 2，无 I/O 依赖**。

| 任务 | 说明 |
|------|------|
| 定义 Interface 类型（`Controller`, `Resource`, `Task`, `Option` 等） | 基于 ProjectInterface V2 协议 |
| `parseInterface(json) → ParsedInterface` | 解析 interface.json |
| `mergeInterfaces(base, ...imports) → ParsedInterface` | Import 合并逻辑 |
| 编写单元测试 | 覆盖 v2 各字段、import 合并、preset 等 |

### Phase 4：数据模型（Snapshot 三层视图）

**产出物**：`FileView` → `BundleView` → `ResourceSnapshot` + 查询方法 + 测试。

| 任务 | 文件 | 说明 |
|------|------|------|
| `FileView` | `src/snapshot/file-view.ts` | 单文件视图：`tasks: Map<TaskName, TaskEntry[]>` + `decls`/`refs`，不跨文件合并 |
| `BundleView` | `src/snapshot/bundle-view.ts` | Bundle 级视图：`files` + `images` + `defaultConfig` + `resolveTask()`（Bundle 内覆盖） |
| `ResourceSnapshot` | `src/snapshot/snapshot.ts` | 全局视图：`bundles[]` + `locateBundle()` + `resolveTask()` + `listTasks()` + `allDecls()`/`allRefs()` |
| Completions | `src/snapshot/completions.ts` | 补全项生成：接受 Snapshot + position，返回补全列表 |
| 单元测试 | | 多 Bundle 叠加、同文件重复 key、跨文件覆盖、图像独立性 |

**关键设计**：
- `images` 在 `BundleView` 中（Bundle 级），不在 `FileView` 中
- 不可变：修改操作返回新 Snapshot，旧 Snapshot 不受影响
- Consumer 不再需要 `mergedDecls.filter(d => d.file === file)`

### Phase 5：诊断引擎

**产出物**：纯函数诊断系统 + 测试。

| 任务 | 说明 |
|------|------|
| `checkPipeline(snapshot) → Diagnostic[]` | 基于 ResourceSnapshot 的 pipeline 诊断（替代当前 checkTask） |
| `checkInterface(snapshot) → Diagnostic[]` | 基于 ResourceSnapshot 的 interface 诊断 |
| `performDiagnostic(snapshot, options) → Diagnostic[]` | 组合诊断 + 过滤 |
| `buildDiagnosticMessage(root, diag, evalPos) → [start, end, brief]` | i18n 消息格式化 |
| 编写诊断测试 | 构造特定 snapshot 状态，验证诊断输出 |

### Phase 6：Runtime 模块

**产出物**：拆分验证/构建 + 纯函数测试。**独立于 Phase 4-5（操作 Interface 类型，不依赖 Snapshot）**。

| 任务 | 说明 |
|------|------|
| **拆分 `validateControllerConfig`** | 纯验证——检查 config 是否有效（adb 配了没、win32 hwnd 有没有）。**不访问 `maa.*`，webview 可安全调用（TODO#17）** |
| `buildControllerRuntime` | 内部调用 `validateControllerConfig` + 构建 args——**仅 extension 使用** |
| `buildResourceRuntime` | 纯数据转换，无 maa 依赖（保持现有实现） |
| `buildOption` | 选项依赖链解析，无 maa 依赖（保持现有实现） |
| `buildTaskRuntime` | 适配新类型 |
| 编写单元测试 | 覆盖所有 controller 类型、option 链、pipeline_override 合并 |

### Phase 7：I/O 适配器 + 编排层

**产出物**：可加载真实文件的端到端系统。

| 任务 | 说明 |
|------|------|
| `FsContentLoader` / `FsContentWatcher` | 从旧代码迁移到 `src/io/fs/` |
| `Project` | 编排器：从 IContentLoader 加载文件 → 构建 ResourceSnapshot → 管理 active 状态 |
| `WatchedProject` | 继承 Project + IContentWatcher → 文件变更时自动重建 Snapshot + onChange 回调 |
| 集成测试 | 用临时目录 + 真实文件结构验证 |

### Phase 8：Consumer 迁移 + 替换

**产出物**：旧包替换，consumers 适配新 API。

| 任务 | 说明 |
|------|------|
| **extension 适配** | `InterfaceBundle` → `WatchedProject`；事件 → `onChange`；`mergedDecls.filter()` → `locateBundle().file.decls`；`ctrlRt` → `validateControllerConfig` |
| **maa-tools 适配** | 使用 `Project`（无监视）；`snapshot.diagnose()` |
| **webview 适配** | `buildControllerRuntime` → `validateControllerConfig` — 移除 `globalThis.maa` Proxy hack |
| 替换旧包 | 删除 `pkgs/maa-pipeline-manager/`，`maa-pipeline-vNext/` 重命名 |
| 版本号 | `2.0.0` |
| 标记 TODO 完成 | TODO#17 ✅, TODO#22 ✅, TODO#24 ✅ |
| 更新文档 | `docs/maa-pipeline-manager/models/`, `tech/`, `specs/` 三份文档同步更新 |

## 模块依赖关系（目标状态）

```
                    ┌─────────────┐
                    │  consumers  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼───┐  ┌────▼─────┐  ┌───▼──────────┐
     │  Watched   │  │  Project │  │  diagnostic/  │
     │  Project   │  │          │  │  (pure)       │
     └──────┬─────┘  └────┬─────┘  └───▲──────────┘
            │             │             │
            │      ┌──────▼──────┐      │
            │      │  snapshot/  │      │
            │      │  (pure)     ├──────┘
            │      └──────▲──────┘
            │             │
     ┌──────▼─────┐  ┌────┴────────┐
     │   io/fs/   │  │  pipeline/  │
     │  (node)    │  │  interface/ │
     └────────────┘  │  runtime/   │
                     │  (pure)     │
                     └─────────────┘
```

- **纯函数层**（pipeline, interface, snapshot, diagnostic, runtime）：零外部依赖（除 jsonc-parser 和 maa-tasker），可在任何 JS 运行时测试
- **I/O 适配层**（io/fs）：Node.js 实现，可替换
- **编排层**（project）：组合纯函数 + I/O 适配器，consumer 的直接入口

## 文件变更清单

### 新建文件

| 文件 | 说明 |
|------|------|
| `src/path/interface.ts` | IPathUtils 接口 |
| `src/path/node.ts` | NodePathUtils 实现 |
| `src/pipeline/types.ts` | Pipeline 类型定义 |
| `src/pipeline/parser.ts` | parsePipeline() 纯函数 |
| `src/pipeline/v1v2.ts` | v1 ↔ v2 规范化 |
| `src/pipeline/default-pipeline.ts` | default_pipeline.json 解析 |
| `src/interface/parser.ts` | parseInterface() 纯函数 |
| `src/interface/merge.ts` | Import 合并 |
| `src/snapshot/file-view.ts` | FileView：单文件视图 |
| `src/snapshot/bundle-view.ts` | BundleView：一个资源目录的数据集合 |
| `src/snapshot/snapshot.ts` | ResourceSnapshot：跨 Bundle 全局视图 |
| `src/snapshot/completions.ts` | 补全项生成 |
| `src/diagnostic/pipeline.ts` | checkPipeline() |
| `src/diagnostic/interface.ts` | checkInterface() |
| `src/diagnostic/index.ts` | performDiagnostic() |
| `src/io/fs/loader.ts` | FsContentLoader（从 content/ 迁移） |
| `src/io/fs/watcher.ts` | FsContentWatcher（从 content/ 迁移） |
| `src/project/project.ts` | Project 编排器 |
| `src/project/watcher.ts` | WatchedProject |
| `src/__tests__/` | 测试目录（pipeline/, interface/, snapshot/, diagnostic/, runtime/） |
| `vitest.config.ts` | Vitest 配置 |

### 保留并修改的文件

| 文件 | 变更 |
|------|------|
| `src/index.ts` | 更新导出列表 |
| `src/types.ts` | 从 utils/types.ts 迁移品牌化类型，移除 path 依赖 |
| `src/utils/json.ts` | 不变（纯函数，无 Node 依赖） |
| `src/utils/helper.ts` | 微调：findDeclRef、extractTaskRef 等纯函数保留 |
| `src/runtime/` | 适配 Snapshot 参数 |
| `src/diagnostic/types.ts` | 保留 Diagnostic 类型定义 |
| `src/diagnostic/message.ts` | 保留 buildDiagnosticMessage()，适配新参数 |
| `src/io/loader.ts` | 保留 IContentLoader 接口 |
| `src/io/watcher.ts` | 保留 IContentWatcher 接口 |
| `package.json` | 更新 exports 和 scripts（添加 test 脚本） |
| `tsconfig.json` | 根据需要调整 |

### 删除的文件

| 文件/目录 | 原因 |
|-----------|------|
| `src/bundle/` | 功能迁移到 snapshot/ + project/ |
| `src/content/json.ts` | ContentJson 功能迁移到 Project |
| `src/content/loader.ts` | 移至 src/io/ |
| `src/content/watch.ts` | 移至 src/io/ |
| `src/layer/layer.ts` | 功能拆分到 snapshot/bundle-view.ts + snapshot/file-view.ts |
| `src/interface/interface.ts` | InterfaceBundle 拆分到 Project + snapshot |
| `src/interface/language.ts` | LanguageBundle 迁移到 Project 内部 + snapshot |
| `src/diagnostic/diagnostic.ts` | 旧 performDiagnostic，已重写 |
| `src/diagnostic/task.ts` | 重写为 diagnostic/pipeline.ts |
| `src/diagnostic/interface.ts` | 重写为 diagnostic/interface.ts |
| `src/parser/` 整个目录 | 解析器重写为纯函数。**注意**：`parser/utils.ts` 中的 parseObject、isString 等工具函数保留，移动到 `src/utils/` |

## 验证方式

### 单元测试

每个 Phase 完成后运行 `pnpm vitest`：

- **Phase 2**：解析器测试 — 用 MaaFramework sample 项目中的真实 JSON 文件作为 fixture
- **Phase 3**：Snapshot 查询测试 — 构造多 Bundle 叠加场景，验证查询结果
- **Phase 4**：诊断测试 — 构造已知错误场景，验证诊断输出
- **Phase 5**：集成测试 — 用临时目录创建真实文件结构，端到端加载
- **Phase 6**：Runtime 测试 — 验证 option 依赖链、pipeline_override 合并

### Consumer 验证

- `@mse/extension`：在 VSCode 中加载真实项目，验证所有 LSP 功能（completion、definition、reference、hover、diagnostic、code lens、inlay hint、document link）行为正确
- `@nekosu/maa-tools`：运行 `maa-tools check` 命令，验证诊断输出与旧版一致

### 性能验证

- 大型项目（如 [M9A](https://github.com/MaaXYZ/M9A)）的加载时间不应退化
- Snapshot 查询应为 O(1) 或 O(log n)，不应比当前 `flushMergedDeclsRefs` 慢

## 对其他 TODO 的影响

### TODO#18（全量 State 同步性能）— 几乎无帮助

**问题回顾**：ControlPanel webview 全量同步 State 时，`interfaceJson` 对象过大，导致 Vue 响应式对象重建延迟严重。

**关键事实**：TODO#18 传输的是 **Interface 信息**（controllers、resources、tasks 元数据、options/cases + pipeline_override），不是 Bundle 的 pipeline 数据。Interface 来自 `interface.json`，只在用户编辑该文件时才变化（低频）。高频 text input 场景下，Interface 是完全相同的对象，只是 `pushInterface()` 每次都重新发送。

**重写能提供的改善**：

| 环节 | 改善 | 说明 |
|------|------|------|
| structuredClone | ✅ 消除 | Snapshot 不可变，`interfaceJson` getter 可直接返回内部引用 |
| IPC 传输 | ❌ 无帮助 | Interface 不因 Bundle 变更而变；高频场景下 Interface 是同一个对象，重复传输是 IPC 协议问题（`updateState` 和 `updateInterface` 边界不合理），不是数据模型问题 |
| Vue 响应式 | ❌ 不在此库范围 | 需 webview 侧做增量 patch 或将 Interface 隔离出主 state |

**结论**：本重写对 TODO#18 基本无帮助。消除 `structuredClone` 是微小改进，核心瓶颈在 IPC 协议和 Vue 响应式层面。重写后标记 TODO#18 为不涉及。

### TODO#17（模拟 globalThis.maa）— 解决

**问题回顾**：Webview 的 `control/state.ts` 使用 Proxy 伪造 `globalThis.maa`，因为 import `./logic` 会触发 `maa.*` 运行时访问。

**调用链分析**：

```
Webview 实际调用：
  buildControllerRuntime(interface, config)  ← 触发 maa.* 访问！
    → webview 只需要 "验证是否成功"（controllerConfigured 布尔值）
    → 不需要 args 里的 int 值

  buildResourceRuntime(interface, config)    ← 无 maa 依赖 ✅
  buildOption(interface, task, ctrlRtBase, resRt)  ← 无 maa 依赖 ✅
```

**根本原因**：`buildControllerRuntime` 把两件事混在一个函数里：

| 职责 | webview 需要？ | 依赖 maa？ |
|------|:---:|:---:|
| **验证**：controller config 是否有效（adb 配了没、win32 hwnd 有没有）| ✅ 需要 | ❌ 不需要 |
| **构建 args**：把 string name 转成 int 值 | ❌ 不需要 | ✅ 需要（Win32/Gamepad 的默认 int 值） |

Webview 只需要验证结果（`controllerConfigured` 布尔值判断能否 launch），但调用 `buildControllerRuntime` 必然触发 args 构建中的 `maa.*` 访问。

**方案**：拆分函数——验证逻辑独立，webview 只调验证函数：

```typescript
// 纯验证 — 无 maa 依赖，webview / extension 均可安全调用
function validateControllerConfig(data: Interface, config: InterfaceConfig): null | string
//  返回 null = 有效，返回 string = 错误信息

// 完整构建 — extension 使用，内部调用 validateControllerConfig + 构建 args
function buildControllerRuntime(data: Interface, config: InterfaceConfig): ControllerRuntime | string
```

Webview 改为：

```typescript
// 替代原来的 ctrlRt = buildControllerRuntime(...)
const controllerError = validateControllerConfig(interfaceJson, config)
const controllerConfigured = computed(() => !controllerError)
```

**效果**：`./logic` 子路径不再需要 `globalThis.maa`。TODO#17 彻底解决。

### Bundle 命名重命名（Layer → Bundle）

当前代码中的 `LayerInfo` / `Layer` 概念本质上是"一个 Bundle 加载后的数据集"，与官方"Bundle 按顺序叠加"的行为对应。重写时统一命名：

| 旧名 | 新名 | 说明 |
|------|------|------|
| `LayerInfo` | `BundleView` | 一个 Bundle 目录的完整数据集 |
| `LayerInfo.parent` | Bundle 链（Snapshot 中按 `bundles[]` 顺序叠加） | 多个 Bundle 按 `resource[].path` 顺序构成层级 |
| `layer.ts` | `bundle-view.ts` | 文件命名 |
| `locateLayer()` | `snapshot.locateBundle()` | 查询方法命名 |

在 Phase 1 阶段完成重命名后，所有新增/修改代码均使用新的 Bundle 命名。

## 参见

- [TODO#22](../../TODO.md) — Node.js API 耦合
- [TODO#24](../../TODO.md) — 事件驱动导致 checker 使用困难
- [MaaFramework 任务流水线协议](https://github.com/MaaXYZ/MaaFramework/blob/main/docs/zh_cn/3.1-%E4%BB%BB%E5%8A%A1%E6%B5%81%E6%B0%B4%E7%BA%BF%E5%8D%8F%E8%AE%AE.md)
- [MaaFramework ProjectInterface V2 协议](https://github.com/MaaXYZ/MaaFramework/blob/main/docs/zh_cn/3.3-ProjectInterfaceV2%E5%8D%8F%E8%AE%AE.md)
