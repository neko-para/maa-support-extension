# Pipeline Manager — LSP 逻辑迁移评估

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 一、现状：LSP 策略分散在两处

当前 LSP 相关逻辑分布在两个包中：

```
@nekosu/maa-pipeline-manager (库)     @mse/extension (LSP Provider)
├── extractTaskRef / isAnchorRef      ├── makeDecls / makeRefs
├── findDeclRef / findMaaDeclRef      ├── getTaskBrief / getTaskHover
├── LayerInfo.mergedDecls/Refs        ├── getImageHover / getLocaleHover
├── LayerInfo.getTaskList()           ├── evalTask (wrapper)
├── LayerInfo.getAnchorList()         ├── CompletionSpec
├── LayerInfo.getTaskBriefInfo()      ├── resolveCompletionSpec
├── InterfaceBundle.localeLayer()     ├── buildCompletionItems
├── InterfaceBundle.topLayer          ├── Hover content assembly
├── performDiagnostic()               ├── CodeLens logic
└── buildDiagnosticMessage()          └── DocumentLink resolution
```

## 二、迁移评估矩阵

### 直接可迁移（纯数据变换，零 VSCode 依赖）

| 函数                    | 当前位置                 | 迁移到                             | 输入                                               | 输出                     |
| ----------------------- | ------------------------ | ---------------------------------- | -------------------------------------------------- | ------------------------ |
| `makeDecls`             | `pipeline/base.ts`       | `core/matching/decl-match.ts`      | `TaskDeclInfo[]`, `TaskRefInfo[]`, `decl?`, `ref?` | `TaskDeclInfo[]`         |
| `makeRefs`              | `pipeline/base.ts`       | `core/matching/ref-match.ts`       | `TaskDeclInfo[]`, `TaskRefInfo[]`, `decl?`, `ref?` | `TaskRefInfo[]`          |
| `makeMaaDecls`          | `pipeline/base.ts`       | `core/matching/maa-match.ts`       | `TaskDeclInfo[]`, `TaskName`                       | `{ file, offset }[]`     |
| `makeMaaRefs`           | `pipeline/base.ts`       | `core/matching/maa-match.ts`       | `TaskRefInfo[]`, `TaskName`                        | `{ file, offset }[]`     |
| `getTaskBrief`          | `pipeline/base.ts`       | `core/query/task-info.ts`          | `InterfaceBundle`, `TaskName`, `TaskName?`         | `string`                 |
| `getTaskRecoAct`        | `pipeline/base.ts`       | `core/query/task-info.ts`          | `InterfaceBundle`, `TaskName`, `TaskName?`         | `[string, string]`       |
| `CompletionSpec`        | `pipeline/completion.ts` | `core/completion/spec.ts`          | (纯 class，无外部依赖)                             | —                        |
| `resolveCompletionSpec` | `pipeline/completion.ts` | `core/completion/resolve.ts`       | `TaskRefInfo`                                      | `CompletionSpec \| null` |
| `interface.makeDecls`   | `interface/base.ts`      | `core/matching/interface-match.ts` | `InterfaceInfo`, `decl?`, `ref?`                   | `InterfaceDeclInfo[]`    |
| `interface.makeRefs`    | `interface/base.ts`      | `core/matching/interface-match.ts` | `InterfaceInfo`, `decl?`, `ref?`                   | `InterfaceRefInfo[]`     |

### 可迁移但需适配（依赖 pipeline-manager 内部 API）

| 函数                   | 当前位置                 | 需适配点                                                                                         |
| ---------------------- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| `buildCompletionItems` | `pipeline/completion.ts` | 依赖 `this.getTaskBrief` / `this.getLocaleHover` → 改为接受函数参数                              |
| `getTaskHover`         | `pipeline/base.ts`       | 依赖 `rootService` + `vscode.workspace.openTextDocument` → 纯文本部分可迁移，VSCode 渲染部分保留 |
| `getImageHover`        | `pipeline/base.ts`       | 依赖 `rootService` + `vscode.Uri.file` → 纯数据部分（获取图片路径列表）可迁移                    |

### 不可迁移（VSCode API 耦合）

| 函数                      | 原因                                                 |
| ------------------------- | ---------------------------------------------------- |
| `provideCompletionItems`  | VSCode Provider 协议，处理 `TextDocument`/`Position` |
| `provideHover`            | VSCode Hover/MarkdownString                          |
| `provideDefinition`       | VSCode Location/LocationLink                         |
| `provideReferences`       | VSCode Location                                      |
| `provideCodeLens`         | VSCode CodeLens/Command                              |
| `provideDocumentLink`     | VSCode DocumentLink                                  |
| `provideCodeActions`      | VSCode CodeAction/WorkspaceEdit                      |
| `provideInlayHints`       | VSCode InlayHint                                     |
| `provideWorkspaceSymbols` | VSCode SymbolInformation                             |
| `resolveCompletionItem`   | VSCode CompletionItem                                |
| 所有 `convertRange*` 函数 | VSCode Range/Location                                |

## 三、迁移后的 LSP Provider 代码量估算

### 当前

| 文件                      | 行数 | 性质                                |
| ------------------------- | ---- | ----------------------------------- |
| `pipeline/base.ts`        | ~400 | 匹配 + 查询 + 基础设施              |
| `pipeline/completion.ts`  | ~370 | CompletionSpec + builder + Provider |
| `pipeline/hover.ts`       | ~80  | VSCode Hover 渲染                   |
| `pipeline/definition.ts`  | ~90  | 薄封装                              |
| `pipeline/reference.ts`   | ~80  | 薄封装                              |
| `interface/base.ts`       | ~175 | 匹配 + 查询                         |
| `interface/completion.ts` | ~160 | 薄封装（重复模式）                  |

### 迁移后

| 文件                            | 行数  | 性质                                           |
| ------------------------------- | ----- | ---------------------------------------------- |
| `pipeline/base.ts`              | ~150  | 仅基础设施（flush, locate, eval task wrapper） |
| `pipeline/completion.ts`        | ~120  | 仅 Provider 入口 + VSCode 适配 + 旧逻辑        |
| `pipeline/completion-legacy.ts` | ~240  | 旧逻辑（待删除）                               |
| `pipeline/hover.ts`             | ~80   | 不变                                           |
| `pipeline/definition.ts`        | ~50   | 更薄的封装                                     |
| `pipeline/reference.ts`         | ~50   | 更薄的封装                                     |
| `interface/base.ts`             | ~90   | 减半                                           |
| `interface/completion.ts`       | ~100  | 减半                                           |
| `core/matching/*`               | +~200 | 移至库                                         |
| `core/completion/*`             | +~200 | 移至库                                         |
| `core/query/*`                  | +~100 | 移至库                                         |

**净效果**：LSP 侧减少 ~350 行逻辑代码，库侧增加 ~500 行可复用、可测试的纯逻辑代码。

## 四、CompletionSpec 迁移细节

`CompletionSpec` 及其相关函数是纯 TypeScript，零外部依赖：

```
core/completion/
├── spec.ts            # CompletionSpec class + factories
├── resolve.ts         # resolveCompletionSpec(ref) → spec | null
└── builder.ts         # buildCompletionItems(ref, spec, layer, intBundle, hooks)
```

`builder.ts` 需要注入两个回调（替代当前 `this.getTaskBrief` / `this.getLocaleHover`）：

```typescript
type CompletionBuilderHooks = {
  getTaskBrief: (task: TaskName) => string
  getLocaleHover: (key: string) => Promise<string | null>
}

function buildCompletionItems(
  ref: TaskRefInfo,
  spec: CompletionSpec,
  layer: Layer,
  intBundle: InterfaceBundle, // 或更精确的 ProjectState
  hooks: CompletionBuilderHooks
): CompletionItem[] // 返回纯数据结构，不含 VSCode Range
```

LSP Provider 侧负责：

1. 调用 `resolveCompletionSpec(ref)`
2. 提供 hooks（`this.getTaskBrief.bind(this)` 等）
3. 调用 `buildCompletionItems(ref, spec, ...)`
4. 将返回的纯数据 CompletionItem 转换为 VSCode CompletionItem（注入 `range`、`command` 等）

## 五、不迁移的部分

以下逻辑**保留在 LSP 侧**，不迁移到库：

1. **VSCode Range/Location 计算**：`convertRangeWithDelta` 等是 VSCode API 的 adapter
2. **Provider 注册和生命周期**：`registerCompletionItemProvider` 等
3. **设置开关**：`pipelineCompletionV2` 是 extension 的实现细节
4. **Command 构造**：`TriggerCompletion` 等 VSCode 命令
5. **异步文档操作**：`openTextDocument`、`positionAt`
6. **图片预览**：MarkdownString 中的图片嵌入
7. **MAA 特殊处理**：MAA 路径检测（`isMaaAssistantArknights`）保留在 extension

## 六、迁移优先级

| 优先级 | 模块                                        | 理由                                                |
| ------ | ------------------------------------------- | --------------------------------------------------- |
| P0     | `extractTaskRef`, `isAnchorRef`             | 已实现，仅需移动文件。匹配逻辑的基础。              |
| P0     | `makeDecls`, `makeRefs`                     | LSP 侧的核心策略函数，迁移后 checker 可复用。       |
| P1     | `CompletionSpec`, `resolveCompletionSpec`   | 刚完成重构，代码新鲜。纯逻辑，迁移成本低。          |
| P1     | `buildCompletionItems`                      | 需解耦 `this` 依赖，改为 hooks 注入。               |
| P2     | `getTaskBrief`, `getTaskRecoAct`            | 简单的数据聚合，迁移后可被 checker 的诊断消息复用。 |
| P2     | `interface.makeDecls`, `interface.makeRefs` | 匹配逻辑，迁出后 interface completion 变薄。        |
| P3     | `getTaskHover` (纯文本部分)                 | 需分离 VSCode Markdown 渲染和数据聚合。             |
| P3     | `getImageHover` (纯数据部分)                | 需分离文件系统查询和 VSCode 渲染。                  |

## 七、诊断文案分离

当前 `diagnostic/message.ts` 中的 `buildDiagnosticMessage()` 在 pipeline-manager 库中生成人类可读的诊断消息。这与原则相悖——pipeline-manager 的诊断不应包含文案逻辑。

### 目标

```
pipeline-manager (库)                    extension / maa-tools (展示层)
├── diagnostic/types.ts                  ├── diagnostic-messages.ts
│   Diagnostic 类型定义                  │   buildDiagnosticMessage(diag, locale)
│   (结构化数据，无文案)                  │   (文案 + 国际化)
└── diagnostic/diagnostic.ts             └── (VSCode Diagnostic 渲染)
    performDiagnostic(state)
    (检测逻辑，无文案)
```

### 迁移

1. 将 `buildDiagnosticMessage()` 从 pipeline-manager 移到 extension（作为 LSP 展示层的一部分）
2. maa-tools 的 checker 已有自己的消息格式化——两个消费者各自负责文案
3. `Diagnostic` 类型保留在 pipeline-manager——它是纯结构化数据，是库的公共 API 的一部分

## 八、LSP 独立进程考虑

> ⚠️ 此项为远期目标，本次重构不做关键实现，仅做架构准备。

### 当前阻碍

LSP Provider 通过 `interfaceService.interfaceBundle` 直接访问内存中的 `InterfaceBundle` 实例。如果 LSP 在独立进程中运行，需要：

- 将 `ProjectState` 序列化并通过 IPC 传输
- 将 `activeController`/`activeResource` 等会话状态作为 LSP 配置参数传递

### 本次重构中的准备

- `CompletionSpec` / `resolveCompletionSpec` 迁移到 core 后，它们接受纯数据（`TaskRefInfo`），不依赖 VSCode 或进程内状态——天然适合独立进程
- `ProjectState` 设计为可序列化的纯数据结构——可以在 IPC 两侧共享
- `buildCompletionItems` 的 hooks 模式（注入 `getTaskBrief`/`getLocaleHover`）使得 VSCode 侧的实现细节不会泄漏到 core 逻辑中
- 当 LSP 独立进程化时，只需要替换 hooks 的实现（从直接内存访问变为 IPC 查询），core 逻辑无需改动
