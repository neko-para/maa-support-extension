# Pipeline Manager 重构 — 实施路线图

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本文档整合 [架构分析](./20260607-pipeline-manager-arch-analysis.md)、[核心重构方案](./20260607-pipeline-manager-core-redesign.md)、[可测试性设计](./20260607-pipeline-manager-testability.md)、[LSP 迁移评估](./20260607-pipeline-manager-lsp-migration.md) 中的实施步骤，形成统一的执行计划。

## 总览

```
Phase 1               Phase 2               Phase 3               Phase 4
提取纯逻辑             IO 分离               编排可选化             清理 + LSP 迁移

core/ 创建        →   io/ 子路径        →   orchestration/    →   删除兼容层
parser 移入           同步 API              子路径                  LSP Provider 减薄
diagnostic 移入       checker 迁移          Extension 迁移          diagnostic 消息移出
Layer 拆分                                  事件驱动独立
matching 提取
MAA 结构分离
测试基础设施
```

## Phase 1：提取纯逻辑

**目标**：创建 `core/`，将所有无平台依赖的逻辑移入。不破坏现有 API（通过 re-export 保持兼容）。

### 1.1 准备工作

- [x] 添加测试框架（`vitest`）+ 4 个 parser 测试通过
- [x] Parser 测试辅助：`parseTaskFromJson(jsonString)` + `findRef()` 辅助函数
- [x] 修正 ESLint glob pattern（`eslint.config.mts` 中包名与实际目录不匹配），修复暴露的已有 lint 错误

### 1.2 core 目录创建

- [x] 创建 `src/core/matching/` 目录
- [ ] 移入 `utils/types.ts`（品牌化类型），解耦 `node:path` — 推迟到 Phase 2（与 io/ 子路径一起处理）

### 1.3 Parser 迁移

- [x] 创建 `parser/task/fw/` 和 `parser/task/maa/` 子目录
- [x] `fw/keys.ts` + `maa/keys.ts` — key 数组分离；`keys.ts` 改为 re-export
- [x] `splitNode()` 内部拆分为 `splitNodeWithV2`（MaaFramework，含 V1/V2 检测）和 `splitNodeSimple`（MAA），接受显式 key 数组；`splitNode(node, maa)` 保留为兼容入口
- [ ] `fw/parse.ts` + `maa/parse.ts` 完全分离 — 推迟到 Phase 4（子解析器共享且无 maa 分支，当前 `parseTask()` 的 `if (maa)` 分支接受现状）
- [ ] core 主路径不依赖 `@nekosu/maa-tasker`（仅 `maa/expr.ts` 依赖）— 推迟到 Phase 4

### 1.4 Diagnostic 迁移

- [x] `checkTask()` 改为接受 `TaskDiagContext`（`{ allLayers, maa, langBundle }`）替代 `InterfaceBundle`
- [x] `checkInterface()` 改为接受 `InterfaceDiagContext`（`{ topLayer, decls, refs }`）替代 `InterfaceBundle`
- [ ] `buildDiagnosticMessage()` 暂留原位，标记为待迁移（Phase 4）

### 1.5 Layer 拆分

- [x] 创建 `model/task-store.ts` — `TaskStore` 类（tasks 增删查、`removeFile`、`collectDecls`/`collectRefs`），`LayerInfo` 通过 getter/setter 委托到 `TaskStore`
- [x] images 保留为 `Set<ImageRelativePath>` 直接操作（无封装价值）
- [ ] 创建 `model/layer.ts` — `Layer` 类（单层容器，不依赖 `IContentLoader`）— 推迟到 Phase 4
- [ ] 创建 `model/layer-tree.ts` — `LayerTree` 类（多层遍历 + 缓存）— 推迟到 Phase 4
- [x] 提取 `eval/eval-task.ts` — `evalTask()` 纯函数，`LayerInfo.evalTask` 委托到 core
- [ ] `specialStringify` / `toggleMode` 移到独立的 `format/`（或标记 deprecated）— 推迟到 Phase 4

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

- [ ] 创建 `src/io/` 目录
- [ ] 移入 `content/loader.ts`、`content/watch.ts`、`content/json.ts`
- [ ] `ContentJson` 中的 `process.nextTick` 替换为可注入的调度函数
- [ ] 子路径入口：`@nekosu/maa-pipeline-manager/io`

### 2.2 同步加载 API

- [ ] 实现 `loadAndParse(root, file)` — 封装"读取 → 解析 → 返回符号图"
- [ ] 实现 `loadProject(root)` — 一次性加载完整的 interface.json + imports + pipeline
- [ ] 返回 `ProjectState`（纯数据结构），不创建 watcher

### 2.3 checker 迁移

- [ ] maa-tools 的 checker 从"创建 InterfaceBundle + 等待事件"切换到 `loadAndParse()` + `performDiagnostic(state)`
- [ ] 消除 checker 侧手动管理 watcher 生命周期

### Phase 2 验证

- [ ] checker 在无文件监视的环境下正常运行
- [ ] checker 结果与 Phase 1 完全一致
- [ ] Extension 侧继续使用旧路径，不受影响

---

## Phase 3：编排可选化

**目标**：创建 `orchestration/` 子路径，事件驱动作为可选编排策略。

### 3.1 orchestration 子路径

- [ ] 创建 `src/orchestration/` 目录
- [ ] 移入 `bundle/bundle.ts`、`bundle/manager.ts`、`interface/interface.ts`、`interface/language.ts`
- [ ] 这些模块改为从 `core/` 导入纯逻辑，从 `io/` 导入 I/O 接口
- [ ] 子路径入口：`@nekosu/maa-pipeline-manager/live`

### 3.2 ProjectState 提取

- [ ] 从 `InterfaceBundle` 提取 `ProjectState` 数据结构（纯数据，不含 I/O/事件）
- [ ] `InterfaceBundle` 变为 `ProjectState` + 事件编排的组合

### 3.3 配置处理迁移

- [ ] 创建 `logic/config/`：
  - `types.ts` — 用户配置类型
  - `resolve.ts` — 配置解析（config + interface → 有效选项）
  - `runtime.ts` — 运行时构建（沿用现有 `logic/runtime/`）
- [ ] `switchActive()` / `updatePaths()` 从 `InterfaceBundle` 移入 `logic/config/`

### 3.4 Extension 迁移

- [ ] Extension 从 `@nekosu/maa-pipeline-manager/live` 导入 `InterfaceBundle`
- [ ] LSP Provider 从 `core/matching/` 导入匹配函数，从 `core/completion/` 导入 CompletionSpec
- [ ] Provider 代码减薄：`makeDecls`/`makeRefs` 调用替换为 core 版本

### Phase 3 验证

- [ ] Extension LSP 功能完整（completion / hover / definition / reference / ...）
- [ ] 事件驱动编排行为与 Phase 1 一致
- [ ] checker 侧继续使用 `loadAndParse`，不受编排层变更影响

---

## Phase 4：清理 + LSP 逻辑最终迁移

**目标**：移除兼容层，完成 LSP 侧逻辑迁移，清理 deprecated 模块。

### 4.1 清理

- [ ] 移除 `LayerInfo` 的 delegating wrapper
- [ ] 移除旧的 parser export 路径
- [ ] 移除 `maa: boolean` 残留引用

### 4.2 LSP Provider 减薄

- [ ] `CompletionSpec`、`resolveCompletionSpec`、`buildCompletionItems` 移入 `core/completion/`
  - `buildCompletionItems` 改为接受 hooks 注入（`getTaskBrief`、`getLocaleHover`）
- [ ] `getTaskBrief`、`getTaskRecoAct` 移入 `core/query/task-info.ts`
- [ ] `getImageInfo`（纯数据部分）移入 `core/query/image-info.ts`
- [ ] LSP Provider 侧仅保留 VSCode API 适配（Range/Location/Hover 渲染）

### 4.3 Diagnostic 消息分离

- [ ] `buildDiagnosticMessage()` 从 pipeline-manager 移到 extension
- [ ] `@nekosu/maa-locale` 的国际化文案与 extension 侧的新消息函数对接
- [ ] pipeline-manager 的 `diagnostic/` 仅输出结构化 `Diagnostic` 数据，不含文案

### 4.4 文档 + 外部通知

- [ ] 更新 `docs/maa-pipeline-manager/` 下的 models / tech / specs 文档
- [ ] 更新 `README.md` 中的 API 使用示例
- [ ] 通知外部使用者（`@nekosu/maa-tools/pm` 子路径消费者）关于导入路径变更
- [ ] 更新 `CLAUDE.md` 中的项目结构说明

### Phase 4 验证

- [ ] LSP Provider 代码量减少 ~350 行
- [ ] core 单测覆盖 matching / completion / query / diagnostic
- [ ] CLI checker 功能正常
- [ ] Extension 所有 LSP 功能正常

---

## 远期目标（非本次重构关键项）

以下目标在本次重构中仅做架构准备，不实施完整功能：

### LSP 独立进程

- **本次准备**：`ProjectState` 设计为可序列化；`CompletionSpec`/hooks 模式使 core 逻辑无 VSCode 依赖；运行时状态（activeController/activeResource）与持久数据（decls/refs/layer）明确分离
- **后续实施**：进程间 IPC 传输 `ProjectState` + LSP 协议集成

### TODO-23（罕见文件删除 Bug）

- 重构中保持 `FsContentWatcher` 的 chokidar 配置不变
- 如替换 watcher 实现需进行并发压力测试

### TODO-26（格式切换）

- `toggleMode()` 实验性功能，可延后处理或标记 deprecated

---

## 依赖关系

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
  │            │            │            │
  │  测试基础设施  │  checker    │  extension  │  清理
  │  core/ 目录   │  同步 API    │  编排层     │  LSP 减薄
  │  parser       │             │  配置迁移   │  消息分离
  │  diagnostic   │             │            │
  │  Layer 拆分   │             │            │
  │  MAA 分离    │             │            │
  │  matching     │             │            │
  └──────────────┴─────────────┴────────────┴──────────

Phase 1 是最关键阶段——建立 core/ 的基础结构后，后续 Phase 是渐进式迁移。
Phase 1-2 对 checker 收益最大（消除事件驱动强制）。
Phase 3 对 extension 架构改善最大（编排可选化）。
Phase 4 是清理收尾。
```
