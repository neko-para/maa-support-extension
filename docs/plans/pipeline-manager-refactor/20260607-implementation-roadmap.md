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

- [ ] 添加测试框架（`vitest`）+ 配置 CI
- [ ] Parser 测试辅助：封装 `parseTaskFromJson(jsonString)` / `parseInterfaceFromJson(jsonString)` 辅助函数，内部通过 `parseTreeWithoutParent` 获取真实 AST

### 1.2 core 目录创建

- [ ] 创建 `src/core/` 目录结构（`parser/`, `model/`, `matching/`, `diagnostic/`, `eval/`, `query/`, `types/`）
- [ ] 移入 `utils/types.ts`（品牌化类型），解耦 `node:path`：将 `joinPath`、`joinImagePath` 等改为接受 path 实现注入

### 1.3 Parser 迁移

- [ ] 移入 `parser/task/` 和 `parser/interface/`（不含 `maa/`）
- [ ] `splitNode()` 的参数从 `maa: boolean` 改为接受 key 数组：`splitNode(node, nodeKeys, recoKeys, actKeys)`
- [ ] MAA 结构分离：创建 `parser/task/fw/` 和 `parser/task/maa/` 两个子目录
  - `fw/split.ts`、`fw/parse.ts`、`fw/keys.ts` — MaaFramework parser（含 V1/V2 自动检测）
  - `maa/split.ts`、`maa/parse.ts`、`maa/keys.ts`、`maa/baseTask.ts`、`maa/expr.ts`、`maa/ref.ts` — MAA parser
  - 两者共享输出类型（`TaskDeclInfo`、`TaskRefInfo`），但实现独立，允许代码重复
  - core 主路径不依赖 `@nekosu/maa-tasker`（仅 `maa/expr.ts` 依赖）

### 1.4 Diagnostic 迁移

- [ ] 移入 `diagnostic/` — `checkTask()` 和 `checkInterface()` 改为接受纯数据参数（`ProjectState` 或 `decls[] + refs[]`）而非 `InterfaceBundle`
- [ ] `buildDiagnosticMessage()` 暂留原位，标记为待迁移（Phase 4）

### 1.5 Layer 拆分

- [ ] 创建 `model/task-store.ts` — `TaskStore` 类（tasks 增删查）
- [ ] 创建 `model/image-store.ts` — `ImageStore` 类（images 集合管理）
- [ ] 创建 `model/layer.ts` — `Layer` 类（单层容器，不依赖 `IContentLoader`）
- [ ] 创建 `model/layer-tree.ts` — `LayerTree` 类（多层遍历 + 缓存）
  - 统一查询接口：`allXxx()` = 跨层，不带前缀 = 单层
  - 缓存（`dirty` + 懒计算）封装在 `LayerTree` 内部
- [ ] 提取 `eval/eval-task.ts` — `evalTask()` 从 `LayerInfo` 分离
- [ ] `specialStringify` / `toggleMode` 移到独立的 `format/`（或标记 deprecated）

### 1.6 Matching 提取

将 LSP `base.ts` 中的匹配逻辑移入 `core/matching/`：

- [ ] `task-ref.ts` — `extractTaskRef`, `isAnchorRef`（从现有 `helper.ts` 移入）
- [ ] `decl-match.ts` — `findMatchingDecls`（← `makeDecls`）
- [ ] `ref-match.ts` — `findMatchingRefs`（← `makeRefs`）
- [ ] `interface-match.ts` — Interface 侧的 `makeDecls`/`makeRefs`
- [ ] 函数接受纯数据参数，返回纯数据结果，不依赖 VSCode API

### 1.7 兼容层

- [ ] 旧 `LayerInfo` 通过 delegating wrapper 保持可用
- [ ] 旧 parser 入口保持可用（re-export）
- [ ] 现有 consumers（extension、maa-tools）不做任何改动

### Phase 1 验证

- [ ] 所有 `core/` 模块的单测通过
- [ ] 现有 consumers 行为不变（extension LSP 功能、maa-tools checker 输出）
- [ ] TypeScript 编译零错误

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
