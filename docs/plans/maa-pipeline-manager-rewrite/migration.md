# Phase 8 Migration Guide: old → vNext

> 扫描 `@mse/extension` 和 `@nekosu/maa-tools` 两个 consumer，映射每个旧 API → 新 API。
>
> 状态标记：
> - ✅ 已实现，直接替换
> - 🔄 接口变化，需调整调用方式
> - ❌ 尚未实现，Phase 8 需要新增
> - ⚠️ 接口不存在但可通过组合实现

## 1. 类型系统

### Branded Types

| 旧 | 新 | 状态 | 说明 |
|----|----|------|------|
| `TaskName` | 同 | ✅ | 从 `types.ts` 导出 |
| `AbsolutePath` | 同 | ✅ | |
| `RelativePath` | 同 | ✅ | |
| `AnchorName` | 同 | ✅ | |
| `ImageRelativePath` | 同 | ✅ | |

### Path 工具

| 旧 | 新 | 状态 | 使用者 |
|----|----|------|--------|
| `joinPath(...)` | `pathUtils.join(...)` | 🔄 | `root.ts`, `documentLink.ts`, `base.ts` (pipeline/interface) |
| `relativePath(base, target)` | `pathUtils.relative(base, target)` | 🔄 | `root.ts` |
| `joinImagePath(maa, root, img)` | `BundleView.imagePath(bundle, pathUtils, image)` | ✅ | `documentLink.ts`, `base.ts` (pipeline) |
| `normalizeImageFolder(img)` | `normalizeImageFolder(pathUtils, image)` | ✅ | `documentLink.ts` |

> ✅ 已实现。`bundleImagePath` 和 `normalizeImageFolder` 在 `snapshot/bundle-view.ts` 中，通过 `snapshot/index.ts` 导出。

### Parser 类型

| 旧 | 新 | 状态 | 使用者 |
|----|----|------|--------|
| `ParserConfig` | 同 | ✅ | `config.ts`, `interface.ts` (extension) |
| `TaskDeclInfo` | 同 | ✅ | `command.ts` |
| `TaskRefInfo` | 同 | ✅ | (internal use) |
| `Diagnostic` | 同 | ✅ | `check/index.ts` (maa-tools) |
| `DiagnosticType` | 同 | ✅ | `config.ts` (maa-tools) |
| `InterfaceDeclInfo` | 同 | ✅ | `base.ts` (interface LSP) |
| `InterfaceRefInfo` | 同 | ✅ | `base.ts` (interface LSP) |
| `InterfaceInfo` | → `ParsedInterface` | 🔄 | `base.ts` (interface LSP) |

### Runtime 类型

| 旧 | 新 | 状态 | 使用者 |
|----|----|------|--------|
| `ControllerRuntime` | 同 | ✅ | `interface.ts`, `launch.ts` (extension) |
| `ResourceRuntime` | 同 | ✅ | - |
| `InterfaceRuntime` | 同 | ✅ | `launch.ts` |

---

## 2. 核心：InterfaceBundle → Project / WatchedProject

这是迁移的核心。旧 `InterfaceBundle` 是中央调度器，新架构拆分为 `Project`（编排）+ `Snapshot`（数据）。

### 构造函数

| 旧 | 新 |
|----|----|
| `new InterfaceBundle(loader, watcher, maa, root, file, parser?)` | `new Project(loader, pathUtils, maa, root, parser?)` |
| | `new WatchedProject(loader, watcher, pathUtils, maa, root, parser?)` |

### 生命周期

| 旧 | 新 | 状态 | 说明 |
|----|----|------|------|
| `bundle.load()` | `project.loadInterface(file?)` | 🔄 | 异步加载 interface.json + imports |
| `bundle.stop()` | (WatchedProject) `project.stopWatching()` | 🔄 | |
| `bundle.flush(flushBundles?)` | **不需要** | ✅ | Snapshot 模式无 flush |
| `bundle.reload()` | `project.reload()` | ✅ | |

### Active 切换

| 旧 | 新 | 状态 | 说明 |
|----|----|------|------|
| `bundle.switchActive(ctrl, res)` | `project.switchActive(ctrl, res)` | 🔄 | 返回 `Promise<void>`，结果通过 `getSnapshot()` 获取 |
| `bundle.activeController` | `project.activeController` | ✅ | |
| `bundle.activeResource` | `project.activeResource` | ✅ | |

### 事件 → 回调

旧 InterfaceBundle 有 8 种事件。extension 的 `InterfaceService` 将它们收敛为 4 个 VSCode EventEmitter：

```
interfaceChanged ───────────→ onInterfaceChanged
importChanged ──────────────→ onInterfaceImportChanged
slaveInterfaceChanged ──────→ onInterfaceChanged (同上)
bundleReloaded ─────────────→ onResourceChanged
pipelineChanged ────────────→ onPipelineChanged
localeChanged ──────────────→ onLocaleChanged
```

各 VSCode 事件的消费者：

| VSCode 事件 | 消费者 | 行为 |
|------------|--------|------|
| `onInterfaceChanged` | codeLens, inlayHint, interface codeLens, webview | 清除内部缓存 / 刷新 |
| `onInterfaceImportChanged` | pipeline LSP base, interface LSP base | `updateProvider()` — 重新注册 LSP provider |
| `onResourceChanged` | pipeline LSP base | `updateProvider()` |
| `onPipelineChanged` | (无外部消费者) | 仅 `this.defer` 注册 |
| `onLocaleChanged` | inlayHint | 刷新 locale 相关展示 |

**分析结论**：所有事件的最终行为都是"刷新 LSP provider / 清除缓存 / 重新诊断"——即用最新数据重建视图。在 Snapshot 模式下，这些可以统一为一个回调：

| 旧事件 | 新 | 状态 |
|--------|----|------|
| 全部 6 种事件 | (WatchedProject) `onChange(snapshot)` | 🔄 |
| `on('switchActiveFinished')` | `await switchActive()` | 🔄 |
| `on('pathChanged')` | **移除** | ❌ |

Consumer 迁移示例：
```typescript
// 旧：分事件处理
bundle.on('interfaceChanged', () => this.interfaceChanged.fire())
bundle.on('bundleReloaded', () => this.resourceChanged.fire())
bundle.on('pipelineChanged', () => this.pipelineChanged.fire())

// 新：统一回调
project.onChange = (snapshot) => {
  this.interfaceChanged.fire()   // 总是刷新所有下游
  this.resourceChanged.fire()
  this.pipelineChanged.fire()
}
```

> 由于 Snapshot 是不可变的轻量对象，所有 downstream 按需读取即可，统一回调不会带来性能问题。

### 关键属性

| 旧 | 新 | 状态 | 使用者 |
|----|----|------|--------|
| `bundle.topLayer` | `snapshot = project.getSnapshot()` | 🔄 | 几乎所有 LSP 文件 |
| `bundle.allLayers` | `snapshot.bundles` | 🔄 | - |
| `bundle.paths` | `project.interfaceData.resource[...]` | 🔄 | `check/index.ts` |
| `bundle.root` | `project.root` | ✅ | |
| `bundle.maa` | `project.maa` | ✅ | |
| `bundle.content.object` | `project.interfaceData` | 🔄 | `interface.ts` (extension) |
| `bundle.imports` / `bundle.importFiles` | `project.interfaceData.import` | 🔄 | `interface.ts`, `base.ts` (pipeline) |
| `bundle.parser` | `project.parser` | ✅ | |
| `bundle.updateParser(p)` | `project.parser = p; await project.reload()` | 🔄 | `interface.ts` (extension) — consumer 侧展开 reload |

### MAA 专用（旧 InterfaceBundle）

| 旧 | 新 | 状态 | 使用者 |
|----|----|------|--------|
| `bundle.maaEvalTask(task)` | **未实现** | ❌ | `command.ts`, `base.ts` (pipeline) |
| `bundle.maaEvalExpr(expr, self, strip)` | **未实现** | ❌ | `command.ts` |
| `bundle.evalTask(task)` | `snapshot.resolveTask(task)` | ✅ | `base.ts` (pipeline) |
| `bundle.evalErrorDelegate` | **未实现** | ❌ | `interface.ts` (extension) — MAA 错误回调 |

---

## 3. 数据查询：LayerInfo → Snapshot / BundleView / FileView

### 文件定位

| 旧 | 新 | 状态 |
|----|----|------|
| `intBundle.locateLayer(absPath)` | `snapshot.locateBundle(absPath)` | ✅ |
| 返回 `[layer, file, isDefault]` | 返回 `{ bundle, file }` — `file.isDefault` 可区分 | |

### 单文件视图（替代 `mergedDecls.filter(d => d.file === file)`）

| 旧 | 新 | 状态 | 使用者 |
|----|----|------|--------|
| `layer.mergedDecls.filter(d => d.file === file)` | `result.file.decls` (从 `locateBundle` 获取) | 🔄 | hover, codeActions, completion, reference, definition |
| `layer.mergedRefs.filter(r => r.file === file)` | `result.file.refs` (从 `locateBundle` 获取) | 🔄 | hover, codeActions, completion, reference, definition |

> FileView 已经内置 `decls`/`refs`——不再需要手动 filter。

### 全局视图（替代 `topLayer.mergedAllDecls` / `mergedAllRefs`）

| 旧 | 新 | 状态 | 使用者 |
|----|----|------|--------|
| `topLayer.mergedAllDecls` | `Snapshot.allDecls(snapshot)` | ✅ | reference, definition, command |
| `topLayer.mergedAllRefs` | `Snapshot.allRefs(snapshot)` | ✅ | reference, definition, codeLens, command |

> 新 API 返回 `DeclWithBundle` / `RefWithBundle`（含 `bundleIndex`），旧代码需适配。

### 任务列表 / 锚点 / 图片

| 旧 | 新 | 状态 | 使用者 |
|----|----|------|--------|
| `layer.getTaskList()` | `Snapshot.listTasks(snapshot)` | ✅ | command, completion, completion-legacy |
| `layer.getAnchorList()` | `Snapshot.getAnchorList(snapshot)` | ✅ | completion, completion-legacy |
| `layer.getImageList()` | `Snapshot.listImages(snapshot)` | ✅ | completion, completion-legacy |
| `layer.getImageFolders()` | `Snapshot.getImageFolders(snapshot)` | ✅ | documentLink, completion, hover |
| `layer.getImage(img)` | `Snapshot.getImage(snapshot, pathUtils, image)` | ✅ | documentLink, hover (pipeline) |
| `layer.getTask(task)` | `Snapshot.getTask(snapshot, name)` | ✅ | hover, codeActions |

> `getImage(img)` 和 `getTask(task)` 返回跨层搜索结果，在新架构中需要通过 `bundles` 遍历实现。

### 任务详情

| 旧 | 新 | 状态 | 使用者 |
|----|----|------|--------|
| `layer.getTaskBriefInfo(task)` | (手动查) | ❌ | completion, completion-legacy |
| `layer.getTaskDoc(task)` | **未实现** | ❌ | webview/launch, inlayHint, hover |
| `layer.toggleMode(1\|2, info, indent)` | **未实现** | ❌ | codeActions |
| `layer.evalTask(task)` | `Snapshot.resolveTask(snapshot, task)` | ✅ | hover, codeActions (via getTaskHover) |
| `layer.maaFindTaskDecl(task)` | **未实现** | ❌ | hover (pipeline MAA mode) |

### 任务属性访问

| 旧 | 新 | 状态 | 使用者 |
|----|----|------|--------|
| `layer.tasks[name]` | `BundleView.findTask(bundle, name)` | 🔄 | codeActions, codeLens |
| `layer.files` | `snapshot.bundles[i].files` | 🔄 | (内部) |

---

## 4. LSP 辅助函数

| 旧 | 新 | 状态 | 使用者 |
|----|----|------|--------|
| `findDeclRef(infos, offset)` | 同 | ✅ | 几乎所有 LSP 文件 |
| `extractTaskRef(r)` | 同 | ✅ | command, codeLens, inlayHint |
| `isAnchorRef(r)` | 同 | ✅ | (internal) |
| `filterDeclRef(infos, offset)` | 同 | ✅ | (internal) |
| `findMaaDeclRef(infos, offset)` | 同 | ✅ | (internal) |

---

## 5. 诊断系统

| 旧 | 新 | 状态 | 使用者 |
|----|----|------|--------|
| `performDiagnostic(bundle, opts)` | `performDiagnostic(snapshot, opts)` | 🔄 | `diagnostic.ts` (extension), `check/index.ts` (maa-tools) |
| `buildDiagnosticMessage(root, diag, locate, opts)` | `buildDiagnosticMessage(root, diag, locate, opts)` | ✅ | `diagnostic.ts` (extension), `check/index.ts` |

> `performDiagnostic` 参数从 `InterfaceBundle` 变为 `ResourceSnapshot`。maa-tools CI checker 需要从 `Project.getSnapshot()` 获取 snapshot。

---

## 6. Runtime 构建

| 旧 | 新 | 状态 | 使用者 |
|----|----|------|--------|
| `buildControllerRuntime(data, config)` | 同 | ✅ | `interface.ts` (extension) |
| `buildResourceRuntime(data, config)` | 同 | ✅ | `interface.ts` (extension) |
| `buildTaskRuntime(data, config, ctrlRt, resRt)` | 同 | ✅ | `interface.ts` (extension) |
| `validateControllerConfig(data, config)` | 同 | ✅ | webview（TODO#17 修复） |

---

## 7. Language / Locale

| 旧 | 新 | 状态 | 使用者 |
|----|----|------|--------|
| `intBundle.langBundle.langs` | `snapshot.languages` | 🔄 | base (pipeline + interface), completion |
| `intBundle.langBundle.queryKey(key)` | **未实现** | ❌ | webview/control, hover (pipeline), base (interface) |
| `intBundle.langBundle.queryName(name)` | **未实现** | ❌ | webview/control, inlayHint |
| `intBundle.langBundle.allKeys()` | **未实现** | ❌ | completion, completion-legacy, codeActions |
| `intBundle.langBundle.addPair(key, value)` | **未实现** | ❌ | codeActions |

> `snapshot.languages` 提供 `LanguageInfo[]`（含 `name`, `file`, `entries: Map<string,string>`）。按 key 查询和编辑操作需要在 consumer 层或用新辅助函数实现。

---

## 8. I/O 层

| 旧 | 新 | 状态 | 使用者 |
|----|----|------|--------|
| `FsContentLoader` | 同 | ✅ | `bundle.ts` (maa-tools) |
| `FsContentWatcher` | 同 | ✅ | `bundle.ts` (maa-tools) |
| `IContentLoader` | 同 | ✅ | (VscodeContentLoader 实现) |
| `IContentWatcher` | 同 | ✅ | (VscodeContentWatcher 实现) |
| `ContentJson<T>` | **移除** | ❌ | `interface.ts` (extension, internal) |

> `ContentJson` 是旧 InterfaceBundle 内部的 JSON 文件监视器，新架构中由 Project 内部管理，不再暴露。

---

## 9. maa-tools 专用

### `loadBundle()` 函数重构

旧 `pkgs/maa-tools/src/utils/bundle.ts`:
```typescript
const bundle = new InterfaceBundle(
  new FsContentLoader(), new FsContentWatcher(),
  false, path.dirname(interfacePath), path.basename(interfacePath), cfg.parser
)
await bundle.load()
await bundle.flush(false)
return bundle
```

新：
```typescript
const project = new Project(
  new FsContentLoader(), nodePathUtils, false, path.dirname(interfacePath), cfg.parser
)
await project.loadInterface(path.basename(interfacePath))
return project
```

### CI Checker

旧 `check/index.ts` 遍历 controller/resource → `switchActive` → `performDiagnostic(bundle, ...)` → `buildDiagnosticMessage(bundle.root, ...)`。

新：遍历 → `switchActive` → `performDiagnostic(project.getSnapshot(), ...)` → `buildDiagnosticMessage(project.root, ...)`。

`bundle.allControllerNames()` / `bundle.allResourceNames(ctrl)` → 遍历 `project.interfaceData.controller` / `project.interfaceData.resource` 的 keys。

`bundle.paths` → `project.interfaceData.resource[name]?.path`。

### `@nekosu/maa-tools/pm` re-export

旧 `pm.ts`: `export * from '@nekosu/maa-pipeline-manager'`。

新：`export * from '@nekosu/maa-pipeline-manager'`（替换旧包后路径不变）。

---

## 10. 未实现功能清单（Phase 8 需要补齐）

### 高优先级（consumer 必需）

| 功能 | 使用者 | 建议 |
|------|--------|------|
| `BundleView.getTaskBriefInfo(task)` | completion, completion-legacy | 提取 reco/act type 字符串 |
| `Snapshot.getTaskDoc(task)` / `BundleView.getTaskDoc(task)` | webview, inlayHint, hover | 从 decls 中收集 `task.doc` |
| `BundleView.toggleMode(mode, info)` | codeActions | v1↔v2 format 切换（可暂缓） |
| Language query API: `queryKey`, `queryName`, `allKeys`, `addPair` | completion, webview, codeActions | 在 Snapshot 或独立 LanguageService 上添加 |
| MAA eval: `maaEvalTask`, `maaEvalExpr` | command, base (pipeline) | 集成 `@nekosu/maa-tasker` 的 `MaaEvalContext` |
| MAA error delegate: `evalErrorDelegate` | interface.ts (extension) | `MaaErrorDelegate` 注入 |

### 低优先级（可延后或 workaround）

| 功能 | 使用者 | 建议 |
|------|--------|------|
| `InterfaceBundle.content.object` | interface.ts (extension) | 用 `project.interfaceData` 替代 |
| `InterfaceBundle.imports` | interface.ts (extension) | 用 `project.interfaceData.import` 替代 |
| `InterfaceBundle.paths` | check/index.ts | 用 `interfaceData.resource[name].path` 替代 |
| `InterfaceBundle.allControllerNames()` | check/index.ts | 用 `Object.keys(interfaceData.controller)` |
| `InterfaceBundle.allResourceNames(ctrl)` | check/index.ts | 用 `Object.keys(interfaceData.resource)` |
| 旧 `joinPath`/`relativePath`/`joinImagePath` | 多个 LSP 文件 | 用 `IPathUtils` 或 `node:path` |
| `isDefault` flag from `locateLayer` | `file.isDefault` in `locateBundle` result | ✅ |
| `layer.files` | codeLens | 在 `BundleView.files` 中遍历 |

---

## 11. 迁移优先级建议

1. **先替换 maa-tools**（无文件监视，API 简单，验证 Project + Snapshot 诊断链路）
2. **再替换 extension**（需要 WatchedProject + 事件回调 + LSP 全链路）
3. **最后处理 MAA 专用功能**（maaEval 需要集成 maa-tasker，复杂度最高）
