# Pipeline Manager — 接口设计

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 一、现状问题

当前三大子系统（core / io / orchestration）的边界已通过文件移动初步建立，但**接口层面**仍是旧的耦合模式：

```
orchestration/InterfaceBundle
  ├── 内部直接调用 parseInterface()（parser API）
  ├── 内部直接创建 ContentJson + Watcher（io API）
  ├── 内部直接操作 LayerInfo（core model）
  └── 对外暴露 EventEmitter + 众多查询方法

orchestration/Bundle
  ├── 内部直接调用 parseTask() + buildTree()（parser API）
  ├── 内部直接操作 LayerInfo.mutableTaskInfo()
  └── 对外暴露 EventEmitter + filterFile/loadFile/deleteFile

io/ContentJson
  ├── 接受 IContentLoader + IContentWatcher
  ├── 内部调用 parseTreeWithoutParent() + buildTree()
  └── 通过 changed 回调通知解析结果
```

**核心问题**：编排层（orchestration）直接调用了解析层（parser）和模型层（LayerInfo），没有通过 io 层提供的抽象。这导致：

- 静态加载路径（`loadProject`）必须复制编排层的逻辑
- watch-based 逻辑无法复用静态加载的原子操作
- 更换 I/O 实现或替换 watcher 策略需要修改编排层代码

## 二、目标架构

```
                    ┌─ orchestration/（可选，watch-based）──┐
                    │  LiveProject ←── 实现 ProjectQuery     │
                    │  LiveBundle                          │
                    │  ContentJson (带 watcher)             │
                    └──────────┬───────────────────────────┘
                               │ 组合
                    ┌──────────▼───────────────────────────┐
                    │  io/（平台适配 + 静态加载）            │
                    │  loadAndParse (纯函数)       │
                    │  loadInterface()    ←─ 原子           │
                    │  loadPipelineFile() ←─ 原子           │
                    │  loadLanguageFile() ←─ 原子           │
                    │  loadProject()      ←─ 组合           │
                    └──────────┬───────────────────────────┘
                               │ 调用
                    ┌──────────▼───────────────────────────┐
                    │  core/（纯逻辑）                       │
                    │  parser / matching / diagnostic       │
                    │  model（TaskStore, ProjectState）      │
                    │  eval / query                         │
                    └──────────────────────────────────────┘
```

**关键原则**：

- orchestration 层**组合** io 原子，不直接调用 parser
- io 层提供原子操作，**不创建自己的 IContentLoader**（由调用方传入）
- core 层定义数据类型和接口，io 和 orchestration 都依赖它

## 三、核心数据类型

### ProjectState —— 统一项目数据（已有，扩展）

Phase 3 已创建 `core/model/project-state.ts`，当前包含 `decls`/`refs`/`layer`/`bundles` + 查询方法。需补全缺失字段使其成为通用数据结构：

```typescript
// core/model/project-state.ts（扩展后）
class ProjectState implements ProjectQuery {
  maa: boolean
  root: AbsolutePath

  // interface 层（已有）
  decls: InterfaceDeclInfo[]
  refs: InterfaceRefInfo[]
  layer: LayerInfo

  // pipeline 层（已有 bundles，当前命名不变）
  bundles: LayerInfo[]

  // 语言文件（新增）
  languages: LanguageData[]

  // 查询方法（已有）
  allControllerNames(onlyWithAttaches?: boolean): string[]
  allResourceNames(checkController?: string): string[]

  // 查询方法（待补全）
  locateLayer(file: AbsolutePath): [LayerInfo, AbsolutePath, boolean] | null

  // ProjectQuery 转发（待补全）
  get allLayers(): LayerInfo[]
  get topLayer(): LayerInfo
  get langBundle(): { ... }
}

interface LanguageData {
  name: string
  file: RelativePath
  entries: { key: string; value: string }[]
  decls: TaskDeclInfo[]
  refs: TaskRefInfo[]
}
```

与当前 `ProjectState` 的差异：新增 `maa`/`root`/`languages`，实现 `ProjectQuery` 接口。

### ProjectQuery —— 统一查询接口

静态和 live 实现的共同契约。

```typescript
// core/model/project-query.ts
interface ProjectQuery {
  allLayers: LayerInfo[]
  maa: boolean
  langBundle: {
    queryKey(key: string): ({ key: string; value: string } | null)[]
    langs: { name: string }[]
  }
  topLayer: LayerInfo
  decls: InterfaceDeclInfo[]
  refs: InterfaceRefInfo[]

  locateLayer(file: AbsolutePath): [LayerInfo, AbsolutePath, boolean] | null
  allControllerNames(onlyWithAttaches?: boolean): string[]
  allResourceNames(checkController?: string): string[]
}
```

`DiagnosticContext` 是 `ProjectQuery` 的子集（仅诊断所需字段），通过 `performDiagnostic` 消费。`ProjectState` 和 `LiveProject` 都实现 `ProjectQuery`。

## 四、io/ 原子操作设计

### loadAndParse

```typescript
async function loadAndParse(
  loader: IContentLoader,
  file: AbsolutePath
): Promise<{ node?: Node; object: unknown }>
```

纯函数——`loader.get(file)` → `parseTreeWithoutParent` → `buildTree`。不需要类包装。

### loadInterface

```typescript
// io/load-interface.ts
async function loadInterface(
  loader: IContentLoader,
  file: AbsolutePath,
  maa: boolean
): Promise<InterfaceInfo>
```

封装：`loader.get(file)` → `parseTreeWithoutParent` → `parseInterface`。

### loadPipelineFile

```typescript
// io/load-pipeline.ts
async function loadPipelineFile(
  loader: IContentLoader,
  file: AbsolutePath,
  maa: boolean,
  parser?: ParserConfig
): Promise<{ tasks: [TaskName, LayerTaskInfo][]; mpeConfigs: TaskDeclInfo[] }>
```

封装：`loader.get(file)` → `parseTreeWithoutParent` → 遍历属性 → `parseTask` + `buildTree`。

### loadLanguageFile

```typescript
// io/load-language.ts
async function loadLanguageFile(
  loader: IContentLoader,
  file: AbsolutePath
): Promise<{ entries: LanguageEntry[]; decls: TaskDeclInfo[]; refs: TaskRefInfo[] }>

interface LanguageEntry {
  key: string
  value: string
  keyNode: StringNode
  valueNode: StringNode
}
```

### loadProject（组合）

```typescript
// io/load-project.ts
async function loadProject(
  loader: IContentLoader,
  root: AbsolutePath,
  interfaceFile?: string,
  maa?: boolean,
  parser?: ParserConfig
): Promise<ProjectState>
```

组合以上原子：

1. `loadInterface(loader, root/file)` → 获取 interface decls/refs
2. 提取 import paths → 对每个 import 递归 `loadInterface`
3. `loadLanguageFile(loader, root/langFile)` → 对每个 language decl
4. 遍历 resource paths → 对每个 pipeline 文件调用 `loadPipelineFile`
5. 组装 `ProjectState`

**关键**：`loadProject` 不创建 loader——由调用方传入。调用方选择 `FsContentLoader` 或 mock。

## 五、orchestration/ 简化——基于 io 原子重构

### ContentJson → 基于 loadAndParse 加 watcher

```typescript
// orchestration/json.ts
class ContentJson<T = unknown> {
  // 内部使用 loadAndParse() + IContentWatcher
  private watcherCtrl?: IContentWatcherController

  constructor(
    loader: IContentLoader,
    watcher: IContentWatcher,
    file: AbsolutePath,
    changed: (node?: Node, obj?: T) => void | Promise<void>
  )

  async load(): Promise<void> // loadAndParse() + watcher.watch()
  stop(): void
  async flush(): Promise<void> // debounce + reload（调用 loadAndParse）
}
```

### 防重入简化

当前 `ContentJson` 和 `BundleManager` 各自实现相同的防重入机制：`duringFlush` 锁 + `flushResolve` Promise 队列 + `needFlush` 标记。这个 Promise 队列是过度设计——调用方无法区分"本次 flush 完成"和"前一次 flush 完成"，且实际场景中重入概率极低。

简化为 `flushing` + `queued` 两个布尔：

```typescript
async flush() {
  if (this.flushing) { this.queued = true; return }
  this.flushing = true
  do {
    this.queued = false
    // ... 实际工作 ...
  } while (this.queued)
  this.flushing = false
}
```

### 防抖策略

`dispatchFlush` 的 100ms `setTimeout` 保留——对分支切换（大量文件变更）是必要的批处理窗口；对编辑场景（单文件变更）100ms 用户无感知。

### ContentJson → 委托到 loadAndParse

`flush()` 内部改为调用 `loadAndParse(this.loader, this.file)`，不再内联 `parseTreeWithoutParent` + `buildTree`。

### Bundle.loadFileImpl → 委托到 loadPipelineFile

`loadFileImpl` 内部改为调用 `loadPipelineFile(this.loader, ...)`，不再内联 `parseTask` + `buildTree`。保留 `deleteFileImpl` 清理 + `changed` 追踪 + emit——这些是真正动态的逻辑。

### LanguageBundle.rebuildIndex → 保持不变

ContentJson 已完成文件读取和 JSON 解析，`rebuildIndex` 只做结构化遍历。内部逻辑与 `loadLanguageFile` 相同但不重复——它操作的是 ContentJson 已加载的 `node`。

### InterfaceBundle ContentJson callback → 保持不变

ContentJson 完成加载，callback 只做 `parseInterface` + emit 事件。不需要改为调用 `loadInterface`——`loadInterface` 会重新读取文件，而 ContentJson 已经读过了。

## 六、统一接口层次

```
┌─────────────────────────────────────────────────┐
│ ProjectQuery（core/model/project-query.ts）      │
│   查询接口：allLayers, topLayer, locateLayer...  │
├─────────────────────────────────────────────────┤
│ ProjectState implements ProjectQuery             │
│   (core/model/project-data.ts)                  │
│   - 静态数据结构，可序列化                       │
│   - 由 loadProject() 返回                       │
├─────────────────────────────────────────────────┤
│ LiveProject extends EventEmitter                │
│   implements ProjectQuery                       │
│   (orchestration/live-project.ts)               │
│   - 持有 ProjectState 快照 + watcher 管理         │
│   - 文件变更时重新加载，更新快照，emit 事件       │
└─────────────────────────────────────────────────┘
```

消费者视角：

- **checker**：`loadProject(loader, root)` → `ProjectState` → `performDiagnostic(data)`
- **extension LSP**：`new LiveProject(loader, watcher, root)` → 订阅事件 + 查询
- **extension 控制面板**：`data.allControllerNames()` / `data.allResourceNames()`

`performDiagnostic` 接受 `ProjectQuery` 的子集（当前 `DiagnosticContext`），两种实现都可传入。

## 七、与现有模块的对应关系

| 当前                            | 重构后                                                 | 变更                                     |
| ------------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| 文件加载 + 解析                 | `io/loadAndParse()`                                    | 纯函数，无状态                           |
| `io/ContentJson`                | `orchestration/ContentJson`                            | 组合 `loadAndParse` + watcher + debounce |
| `Bundle.loadFileImpl`           | `io/loadPipelineFile()`                                | 提取为原子函数                           |
| `Bundle`                        | `orchestration/LiveBundle`                             | 委托到 `loadPipelineFile`                |
| `InterfaceBundle` 构造 + 事件链 | `orchestration/LiveProject`                            | 委托到 `loadInterface` / `loadProject`   |
| `LanguageBundle`                | `io/loadLanguageFile()` + `orchestration/LiveLanguage` | 分离静态加载和 watch                     |
| ad-hoc `DiagnosticContext`      | `core/ProjectState` + `core/ProjectQuery`              | 统一数据结构                             |
| `InterfaceBundle.getState()`    | `LiveProject.data` (ProjectState)                      | 自然表达                                 |

## 八、实施顺序

### Step 1：定义 ProjectState + ProjectQuery（core/）

不依赖任何现有代码变更——纯类型定义。

### Step 2：提取 io 原子函数

- `loadInterface(loader, file, maa)` —— 从 InterfaceBundle 逻辑提取
- `loadPipelineFile(loader, file, maa, parser)` —— 从 Bundle.loadFileImpl 提取
- `loadLanguageFile(loader, file)` —— 从 LanguageBundle.rebuildIndex 提取

每个原子函数独立可用，都可单测。

### Step 3：实现 loadProject 组合函数

使用 Step 2 的原子，组装完整加载流程。返回 `ProjectState`。

### Step 4：重构 orchestration 层

将 `InterfaceBundle` / `Bundle` / `LanguageBundle` 的内部实现改为委托到 io 原子。外部 API 保持不变（向后兼容）。

### Step 5：更新消费者

Checker 可从 `InterfaceBundle` + watcher 切换到 `loadProject`（仅在不需要 `switchActive` 的场景）。
