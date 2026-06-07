# Pipeline Manager 重构 — 实施路线图

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本文档整合 [架构分析](./20260607-pipeline-manager-arch-analysis.md)、[核心重构方案](./20260607-pipeline-manager-core-redesign.md)、[可测试性设计](./20260607-pipeline-manager-testability.md)、[LSP 迁移评估](./20260607-pipeline-manager-lsp-migration.md) 中的实施步骤，形成统一的执行计划。

## 总览

```
Phase 1        Phase 2        Phase 3        Phase 4        Phase 5
提取纯逻辑      IO 分离        编排可选化      加载器 API      Parser 完成

Phase 6        Phase 7        Phase 8
Layer 完成     LSP 迁移       清理 + 构建
```

## Phase 1：提取纯逻辑

**目标**：创建 `core/`，将所有无平台依赖的逻辑移入。不破坏现有 API（通过 re-export 保持兼容）。

### 1.1 准备工作

- [x] 添加测试框架（`vitest`）+ 4 个 parser 测试通过
- [x] Parser 测试辅助：`parseTaskFromJson(jsonString)` + `findRef()` 辅助函数
- [x] 修正 ESLint glob pattern（`eslint.config.mts` 中包名与实际目录不匹配），修复暴露的已有 lint 错误

### 1.2 core 目录创建

- [x] 创建 `src/core/matching/` 目录
- [ ] 移入 `utils/types.ts`（品牌化类型），解耦 `node:path` — 推迟到 Phase 4.3

### 1.3 Parser 迁移

- [x] 创建 `parser/task/fw/` 和 `parser/task/maa/` 子目录
- [x] `fw/keys.ts` + `maa/keys.ts` — key 数组分离；`keys.ts` 改为 re-export
- [x] `splitNode()` 内部拆分为 `splitNodeWithV2`（MaaFramework，含 V1/V2 检测）和 `splitNodeSimple`（MAA），接受显式 key 数组；`splitNode(node, maa)` 保留为兼容入口
- [ ] `fw/parse.ts` + `maa/parse.ts` 完全分离 — 推迟到 Phase 5
- [ ] core 主路径不依赖 `@nekosu/maa-tasker` — 推迟到 Phase 5

### 1.4 Diagnostic 迁移

- [x] `checkTask()` 改为接受 `TaskDiagContext`（`{ allLayers, maa, langBundle }`）替代 `InterfaceBundle`
- [x] `checkInterface()` 改为接受 `InterfaceDiagContext`（`{ topLayer, decls, refs }`）替代 `InterfaceBundle`
- [ ] `buildDiagnosticMessage()` 暂留原位，标记为待迁移（Phase 7）

### 1.5 Layer 拆分

- [x] 创建 `model/task-store.ts` — `TaskStore` 类（tasks 增删查、`removeFile`、`collectDecls`/`collectRefs`），`LayerInfo` 通过 getter/setter 委托到 `TaskStore`
- [x] images 保留为 `Set<ImageRelativePath>` 直接操作（无封装价值）
- [ ] 创建 `model/layer.ts` — 推迟到 Phase 6
- [ ] 创建 `model/layer-tree.ts` — 推迟到 Phase 6
- [x] 提取 `eval/eval-task.ts` — `evalTask()` 纯函数，`LayerInfo.evalTask` 委托到 core
- [ ] `specialStringify` / `toggleMode` 移到 `format/` — 推迟到 Phase 6

### 1.6 Matching 提取

- [x] `task-ref.ts` — `extractTaskRef`, `isAnchorRef`（从 `helper.ts` 移入 core，旧路径 re-export 保持兼容）
- [x] `decl-match.ts` — `findMatchingDecls`（← `makeDecls`）
- [x] `ref-match.ts` — `findMatchingRefs`（← `makeRefs`）
- [x] Extension `base.ts` 的 `makeDecls`/`makeRefs` 改为委托到 core 函数（~80 行方法体 → 1 行调用）
- [x] `interface-match.ts` — Interface 侧的 `findInterfaceMatchingDecls`/`findInterfaceMatchingRefs`（← `makeDecls`/`makeRefs`）

### 1.7 兼容层

- [x] `LayerInfo` 通过 getter/setter 委托到 `TaskStore`，外部 API 不变
- [x] `helper.ts` 通过 re-export 保持旧导入路径兼容
- [x] `keys.ts` 通过 re-export 保持旧导入路径兼容
- [x] `splitNode(node, maa)` 保留为兼容入口
- [x] Extension `interface/base.ts` 的 `makeDecls`/`makeRefs` 改为委托到 core 函数（~80 行方法体 + 2 个 helper → 2 行调用）

### Phase 1 验证

- [x] `core/` 模块 12 个单测通过（4 parser + 5 TaskStore + 3 evalTask）
- [ ] 现有 consumers 行为不变（extension LSP 功能、maa-tools checker 输出）— 需手动在 VSCode 中验证
- [x] TypeScript 编译零错误（pipeline-manager + extension）
- [x] ESLint 零错误（全项目）

---

## Phase 2：IO 分离 + 同步 API

**目标**：创建 `io/` 子路径，提供 checker 友好的同步式加载 API。

### 2.1 io 子路径

- [x] 创建 `src/io/` 目录
- [x] 移入 `content/loader.ts`、`content/watch.ts`、`content/json.ts` → `io/`
- [x] `content/` 保留为 re-export 兼容层
- [x] `ContentJson` 中的 `process.nextTick` 替换为 `queueMicrotask`（标准 API）
- [x] 子路径入口：`@nekosu/maa-pipeline-manager/io`（`package.json` exports 已配置）

### 2.2 同步加载 API

- [x] `loadAndParse(loader, file)` — 封装"读取 → 解析 → 返回 `{ node, object }`"（纯函数，无需类）
- [ ] `loadProject(root)` — 推迟到 Phase 4.1

### 2.3 checker 迁移

- [ ] maa-tools 的 checker 切换到 `loadProject()` + `performDiagnostic(state)` — 推迟到 Phase 4.2

### Phase 2 验证

- [ ] checker 在无文件监视的环境下正常运行 — 推迟到 Phase 4
- [x] Extension 侧继续使用旧路径，不受影响
- [x] TypeScript 编译零错误（pipeline-manager + extension + maa-tools）

---

## Phase 3：编排可选化

**目标**：创建 `orchestration/` 子路径，事件驱动作为可选编排策略。

### 3.1 orchestration 子路径

- [x] 创建 `src/orchestration/` 目录
- [x] 移入 `bundle/` + `interface/` 的事件驱动模块
- [x] 旧位置保留为 re-export 兼容层
- [x] 子路径入口：`@nekosu/maa-pipeline-manager/live`（`package.json` exports 已配置）
- [x] 模块从 `io/` 导入 I/O 接口，从 `core/model/` 导入 `ProjectState`

### 3.2 ProjectState 提取

- [x] 创建 `core/model/project-state.ts` — `ProjectState` 纯数据类（`decls`/`refs`/`layer`/`bundles` + `allControllerNames`/`allResourceNames`）
- [x] `InterfaceBundle.getState()` 返回 `ProjectState` 快照（事件编排 → 纯数据的桥接）

### 3.3 配置处理迁移

- [ ] 创建 `logic/config/` — 推迟到 Phase 8.3
- [ ] `switchActive()` / `updatePaths()` 迁移 — 推迟到 Phase 8.3

### 3.4 Extension 迁移

- [x] LSP Provider 已在 Phase 1 从 `core/matching/` 导入匹配函数
- [ ] Extension 从 `@nekosu/maa-pipeline-manager/live` 导入 `InterfaceBundle` — 推迟（子路径需构建后才能解析，开发阶段继续从主入口导入）

### Phase 3 验证

- [ ] Extension LSP 功能完整 — 推迟（手动 VSCode 验证）
- [x] 事件驱动编排通过 re-export 保持行为不变
- [x] TypeScript 编译零错误（pipeline-manager + extension + maa-tools）

---

## Phase 4：加载器 API + checker 迁移

**目标**：实现 `loadProject()` 完整加载流程，消除 checker 侧事件驱动强制。

### 4.1 DiagnosticContext

- [x] 定义 `DiagnosticContext` 接口（`allLayers`/`maa`/`langBundle`/`topLayer`/`decls`/`refs`）
- [x] `performDiagnostic()` 改为接受 `DiagnosticContext`（`InterfaceBundle` 通过 `decls`/`refs` getter 兼容）
- [x] `InterfaceBundle` 新增 `decls`/`refs` 访问器

### 4.2 loadProject

- [x] 实现 `loadProject(root, file)` — 一次性加载 interface.json + imports + language files + pipeline bundles
  - 全部使用 `FsContentLoader`（无 watcher）
  - 手动读取 pipeline 目录（`fs.readdir`）
  - 返回 `DiagnosticContext` 兼容对象
- [x] `loadProject` 通过 `index.ts` 导出（可被 checker 使用）

### 4.3 checker 迁移

- [ ] checker 从 `InterfaceBundle` + watcher 切换到 `loadProject()` — 推迟（checker 需要 `switchActive` 迭代 controller/resource 对，`loadProject` 目前加载第一组）

### 4.4 路径工具解耦

- [ ] `utils/types.ts` path 工具解耦 `node:path` — 推迟到 Phase 8（与构建配置一起处理）

### Phase 4 验证

- [x] TypeScript 编译零错误（全部包）
- [x] ESLint 零错误
- [x] 12 个现有测试全通过
- [ ] checker 无 watcher 环境验证 — 推迟

---

## Phase 5：Parser 完成

**目标**：`fw/parse.ts` + `maa/parse.ts` 完全分离，消除 `maa: boolean` 标志。

### 5.1 fw/parse.ts

- [ ] 提取 MaaFramework `parseTask` 为独立入口（当前 `if (!maa)` 分支）
- [ ] 内部调用 `splitNodeWithV2` + `parseBase` + `parseReco` + `parseAct` + `parseUnknown`

### 5.2 maa/parse.ts

- [ ] 提取 MAA `parseTask` 为独立入口（当前 `if (maa)` 分支）
- [ ] 内部调用 `splitNodeSimple` + `parseMaaBase` + `parseMaaReco`
- [ ] `buildTaskRef` 移入 `maa/ref.ts`

### 5.3 依赖清理

- [ ] core 主路径不依赖 `@nekosu/maa-tasker`（仅 `maa/expr.ts` 依赖）
- [ ] 旧 `parseTask(node, ctx)` 保留为兼容入口，根据 `ctx.maa` 委托到 fw 或 maa

### Phase 5 验证

- [ ] fw parseTask 输出与当前 `maa=false` 一致
- [ ] maa parseTask 输出与当前 `maa=true` 一致
- [ ] 12 个现有测试全通过

---

## Phase 6：Layer 完成

**目标**：`Layer` 类解耦 `IContentLoader`，提取 `LayerTree` 查询层。

### 6.1 Layer 类

- [ ] 创建 `core/model/layer.ts` — `Layer` 类（`root` + `taskStore` + `images` + `parent`），不依赖 `IContentLoader`
- [ ] `LayerInfo` 改为继承或组合 `Layer`（保持 API 兼容）

### 6.2 LayerTree

- [ ] 创建 `core/model/layer-tree.ts` — `LayerTree` 类
  - `mergedDecls`/`mergedRefs` 缓存
  - `getTaskList`/`getAnchorList`/`getImageList`
  - `getTask`/`getImage`/`getTaskBriefInfo`/`getTaskDoc`
  - `evalTask`（委托到 `core/eval/`）

### 6.3 格式工具

- [ ] `specialStringify` 移到 `core/format/`（或保留在 Layer）
- [ ] `toggleMode` 标记 deprecated（实验性功能，官方不推荐）

### Phase 6 验证

- [ ] `LayerTree` 单测覆盖查询方法和缓存逻辑
- [ ] 现有 consumers 行为不变

---

## Phase 7：LSP 逻辑迁移

**目标**：将 LSP Provider 中的核心策略移入 `core/`，Provider 变为 VSCode 适配层。

### 7.1 Completion 迁移

- [ ] `CompletionSpec`、`resolveCompletionSpec`、`buildCompletionItems` 移入 `core/completion/`
- [ ] `buildCompletionItems` 改为接受 hooks 注入（`getTaskBrief`、`getLocaleHover`）

### 7.2 查询函数迁移

- [ ] `getTaskBrief`、`getTaskRecoAct` 移入 `core/query/task-info.ts`
- [ ] `getImageInfo`（纯数据部分）移入 `core/query/image-info.ts`

### 7.3 Diagnostic 消息分离

- [ ] `buildDiagnosticMessage()` 从 pipeline-manager 移到 extension
- [ ] pipeline-manager 的 `diagnostic/` 仅输出结构化 `Diagnostic` 数据

### Phase 7 验证

- [ ] LSP Provider 代码量减少 ~350 行
- [ ] core 单测覆盖 completion / query / diagnostic

---

## Phase 8：清理 + 构建

**目标**：移除兼容层，完成构建配置，更新文档。

### 8.1 兼容层清理

- [ ] 移除 `content/`、`bundle/`、`interface/` 的 re-export 文件
- [ ] 移除 `parser/task/keys.ts` 的 re-export（改为直接从 `fw/keys` 或 `maa/keys` 导入）
- [ ] 移除 `helper.ts` 的 re-export（改为直接从 `core/matching` 导入）
- [ ] 移除 `LayerInfo` 的 delegating wrapper（如果有）
- [ ] 移除 `splitNode(node, maa)` 兼容入口

### 8.2 构建配置

- [ ] tsdown 配置多入口（`./io`、`./live` 子路径）
- [ ] 验证 `@nekosu/maa-pipeline-manager/io` 和 `/live` 子路径在构建后可解析

### 8.3 配置处理迁移

- [ ] 创建 `logic/config/`（从 InterfaceBundle 分离配置逻辑）
- [ ] `switchActive()` / `updatePaths()` 移入 `logic/config/`

### 8.4 文档

- [ ] 更新 `docs/maa-pipeline-manager/` 下的 models / tech / specs 文档
- [ ] 更新 `CLAUDE.md` 中的项目结构说明
- [ ] 通知外部使用者关于导入路径变更

### Phase 8 验证

- [ ] 全部子路径可正常导入
- [ ] CLI checker 功能正常
- [ ] Extension 所有 LSP 功能正常

---

## 远期目标（非本次重构关键项）

### LSP 独立进程

- **本次准备**：`ProjectState` 设计为可序列化；`CompletionSpec`/hooks 模式使 core 逻辑无 VSCode 依赖
- **后续实施**：进程间 IPC 传输 `ProjectState` + LSP 协议集成

### TODO-23（罕见文件删除 Bug）

- 重构中保持 `FsContentWatcher` 的 chokidar 配置不变

### TODO-26（格式切换）

- `toggleMode()` 实验性功能，可延后处理或标记 deprecated

---

## 依赖关系

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5
 提取纯逻辑    IO 分离     编排可选化    加载器 API    Parser 完成
    │            │            │            │            │
    ▼            ▼            ▼            ▼            ▼
Phase 6 ──→ Phase 7 ──→ Phase 8
 Layer 完成   LSP 迁移    清理 + 构建

Phase 1-3 已完成：core/ 基础结构 + io/ 子路径 + orchestration/ 子路径 + ProjectState
Phase 4-5 解决 TODO-#22/#24：checker 同步加载 + MAA/FW 完全分离
Phase 6-7 解决可测试性 + LSP 减薄
Phase 8 收尾清理
```
