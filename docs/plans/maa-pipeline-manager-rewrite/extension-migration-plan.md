# Extension 渐进式迁移计划

> 两个包名不同（`@nekosu/maa-pipeline-manager` vs `@nekosu/maa-pipeline-manager-vnext`），可同时加载新旧两套模型，逐步替换。

## 引用概览（24 个文件）

```
service/
├── interface.ts          # 核心：InterfaceBundle 生命周期 + 事件 → VSCode EventEmitter
├── diagnostic.ts         # performDiagnostic + buildDiagnosticMessage
├── command.ts            # MAA eval / task list / extractTaskRef
├── launch.ts             # InterfaceRuntime 类型
├── root.ts               # AbsolutePath / relativePath
├── utils/content.ts      # ContentJson → 所有 LSP flush 依赖
└── webview/
    ├── control.ts         # langBundle query + MAA eval
    └── launch.ts          # TaskName / getTaskDoc

language/
├── utils.ts              # AbsolutePath 类型
├── pipeline/
│   ├── base.ts           # 核心 LSP base：flush → locateLayer → mergedDecls/Refs → evalTask/maaEval → langBundle
│   ├── hover.ts          # locateLayer → mergedDecls/Refs → findDeclRef → getTaskHover
│   ├── completion.ts     # locateLayer → mergedDecls/Refs → getAnchorList/getTaskList/getImageList
│   ├── completion-legacy.ts  # 同上（旧版 completion）
│   ├── definition.ts     # locateLayer → mergedDecls/Refs → mergedAllDecls/Refs
│   ├── reference.ts      # 同上
│   ├── codeActions.ts    # locateLayer → mergedDecls/Refs → toggleMode → langBundle.addPair
│   ├── codeLens.ts       # locateLayer → layer.tasks → mergedAllRefs
│   ├── documentLink.ts   # locateLayer → mergedRefs → getImageFolders/getImage
│   ├── inlayHint.ts      # locateLayer → mergedRefs → langBundle.queryName/queryKey → getTaskDoc
│   └── color.ts          # locateLayer → mergedRefs
└── interface/
    ├── base.ts           # 核心 LSP base：flush → InterfaceInfo → findDecl/Ref → langBundle
    ├── definition.ts     # findDeclRef
    ├── reference.ts      # findDeclRef
    └── completion.ts     # findDeclRef
```

## 模块分层（按依赖深度）

### Layer 0：纯类型 + 纯函数（无 InterfaceBundle 依赖）

| 文件 | 依赖 | 迁移难度 |
|------|------|---------|
| `root.ts` | `AbsolutePath`, `relativePath` | 低 — 用 `nodePathUtils.relative` 替代 |
| `launch.ts` | `InterfaceRuntime` | 低 — vNext 已有 |
| `language/utils.ts` | `AbsolutePath` | 低 — 同名类型 |
| `webview/launch.ts` | `TaskName` | 低 — 同名类型 |

### Layer 1：LSP 辅助（依赖 flush → InterfaceBundle，但纯查询模式可解耦）

| 文件 | 核心旧 API | 新 API | 迁移难度 |
|------|-----------|--------|---------|
| `utils/content.ts` | `ContentJson` (被所有 LSP base 继承) | `WatchedProject.getSnapshot()` | **高** — 架构变更，影响所有 LSP |
| `pipeline/base.ts` | `InterfaceBundle`, `LayerInfo`, `joinPath`, `extractTaskRef`, `isAnchorRef` | `Project`, `Snapshot`, `nodePathUtils` | **高** — LSP 基类，影响 12 个子类 |
| `interface/base.ts` | `InterfaceInfo`, `joinPath` | `ParsedInterface`, `nodePathUtils` | 中 |

### Layer 2：LSP 功能实现（依赖 base，纯查询）

| 文件 | 核心旧 API | 新 API | 迁移难度 |
|------|-----------|--------|---------|
| `pipeline/hover.ts` | `locateLayer` → `mergedDecls/Refs` → `findDeclRef` | `locateBundle` → `file.decls/refs` | 中 |
| `pipeline/completion.ts` | 同上 + `getAnchorList/getTaskList/getImageList/getImageFolders` | `Snapshot.*` | 中 |
| `pipeline/completion-legacy.ts` | 同上 | `Snapshot.*` | 中 |
| `pipeline/definition.ts` | 同上 + `mergedAllDecls/Refs` | `Snapshot.allDecls/allRefs` | 中 |
| `pipeline/reference.ts` | 同上 | 同上 | 中 |
| `pipeline/documentLink.ts` | 同上 + `getImageFolders/getImage` | `Snapshot.*` | 中 |
| `pipeline/inlayHint.ts` | 同上 + `langBundle` + `getTaskDoc` | `Snapshot.queryLocale` + `Snapshot.getTaskDoc` | 中 |
| `pipeline/codeLens.ts` | `locateLayer` → `layer.tasks` + `mergedAllRefs` | `locateBundle` → bundle query | 中 |
| `pipeline/color.ts` | `locateLayer` → `mergedRefs` | `locateBundle` → `file.refs` | 低 |
| `interface/definition.ts` | `findDeclRef` | 同（已兼容） | 低 |
| `interface/reference.ts` | `findDeclRef` | 同 | 低 |
| `interface/completion.ts` | `findDeclRef` | 同 | 低 |
| `pipeline/codeActions.ts` | `toggleMode` + `langBundle.addPair` | **TODO** 暂跳过 | **高** — 需新增 API |

### Layer 3：Service 核心（InterfaceBundle 生命周期）

| 文件 | 核心旧 API | 新 API | 迁移难度 |
|------|-----------|--------|---------|
| `interface.ts` | `InterfaceBundle` 构造/事件/load/stop/flush/switchActive/langBundle/eval | `WatchedProject` + `Snapshot` | **最高** — 整个系统的心脏 |
| `diagnostic.ts` | `performDiagnostic(bundle)` + `buildDiagnosticMessage(root, diag, locate, {})` | `performDiagnostic(snapshot)` + `buildDiagnosticMessage(root, diag, locate, pathUtils)` | 中 |
| `command.ts` | MAA eval (`maaEvalTask/Expr`) + `extractTaskRef` + task list | `Snapshot` + **TODO**: MAA eval | 中 — MAA 部分需 TODO |
| `webview/control.ts` | `langBundle.queryKey/queryName` + MAA eval | `Snapshot.queryLocale/LocaleIndex` + **TODO**: MAA eval | 中 — MAA 部分需 TODO |

## 渐进式替换步骤

### Step 1：双模型共存（基础设施）

1. `package.json` 同时保留两个依赖：
   ```json
   "@nekosu/maa-pipeline-manager": "workspace:*",
   "@nekosu/maa-pipeline-manager-vnext": "workspace:*"
   ```
2. `InterfaceService` 同时创建 `InterfaceBundle`（旧）和 `Project`（新），用 `getSnapshot()` 暴露新模型
3. LSP base 继续使用旧 `InterfaceBundle.flush()`，但同时缓存 `Snapshot`

### Step 2：LSP Layer 1+2 切换（逐个文件）

优先级从低到高：

| 顺序 | 文件 | 验证方式 |
|------|------|---------|
| 1 | `root.ts` → `nodePathUtils` | Type check |
| 2 | `launch.ts` → vNext `InterfaceRuntime` | Type check |
| 3 | `diagnostic.ts` → `performDiagnostic(snapshot)` | 加载 MaaEnd 项目，检查诊断输出一致性 |
| 4 | `pipeline/color.ts` → `locateBundle` + `file.refs` | 打开 pipeline 文件，悬浮颜色值 |
| 5 | `pipeline/documentLink.ts` → `Snapshot.getImageFolders/getImage` | 打开 pipeline 文件，Ctrl+Click 模板图片 |
| 6 | `pipeline/definition.ts` → `locateBundle` + `Snapshot.allDecls` | 打开 pipeline 文件，F12 跳转定义 |
| 7 | `pipeline/reference.ts` → 同上 | Shift+F12 查找引用 |
| 8 | `pipeline/hover.ts` → `locateBundle` + Snapshot query | 鼠标悬浮任务名 |
| 9 | `pipeline/completion.ts` → Snapshot query | 输入时自动补全 |
| 10 | `pipeline/completion-legacy.ts` → 同上 | 同上（旧版补全） |
| 11 | `pipeline/inlayHint.ts` → Snapshot locale query + getTaskDoc | 打开有 locale 引用的 pipeline |
| 12 | `pipeline/codeLens.ts` → `locateBundle` | 打开 pipeline 文件，code lens 显示 |
| 13 | `interface/*.ts` (LSP) → 纯 findDeclRef | Type check + 打开 interface.json |
| 14 | `pipeline/codeActions.ts` → **TODO** toggleMode + addPair | 暂保持旧 API，标记 TODO |
| 15 | `command.ts` → Snapshot query + **TODO** MAA eval | 运行 MaaEnd check 对比 |
| 16 | `webview/control.ts` → Snapshot locale + **TODO** MAA eval | 打开 webview 面板，触发 locale 查询 |
| 17 | `webview/launch.ts` → vNext types | Type check |

### Step 3：Service 核心切换

| 顺序 | 文件 | 验证方式 |
|------|------|---------|
| 18 | `pipeline/base.ts` → `WatchedProject` + `Snapshot` + `nodePathUtils` | 所有 LSP 功能回归测试 |
| 19 | `interface/base.ts` → `ParsedInterface` + `nodePathUtils` | 打开 interface.json，所有 LSP 功能 |
| 20 | `utils/content.ts` → 移除 `ContentJson`（base 不再需要） | LSP 功能回归 |
| 21 | `interface.ts` → `WatchedProject` 完全替换 `InterfaceBundle` | **全功能回归测试** |

### Step 4：清理

- 移除 `@nekosu/maa-pipeline-manager` 依赖
- 删除旧包

## 验证检查清单

每个 Step 完成后：

- [ ] Type check 通过
- [ ] 打开 MaaEnd 项目，LSP 功能无回归
- [ ] `maa-tools check` 诊断输出与旧版一致
- [ ] webview 面板正常加载
- [ ] 文件监视：修改 pipeline/interface 文件后 LSP 自动刷新

## TODO 标记格式

对于暂不支持的 MAA 功能：
```typescript
// TODO(Phase8): maaEvalTask — 需要集成 @nekosu/maa-tasker MaaEvalContext
// TODO(Phase8): toggleMode — vNext 需补充 v1↔v2 格式切换
// TODO(Phase8): addPair — 需要 AST 位置 + 文件写入
```
