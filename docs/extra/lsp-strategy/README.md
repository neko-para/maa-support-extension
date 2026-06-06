# LSP 能力实现策略

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

Extension 在 `service/language/` 下实现了两套并行的 Language Provider 体系，为不同的文件类型提供 VSCode 语言服务。

## 体系概览

| 体系 | 基类 | 目标文件 | 能力数 | 详细文档 |
|---|---|---|---|---|
| Interface Language | `InterfaceLanguageProvider` | `interface.json` 及其 import 文件 | 6 | [interface.md](interface.md) |
| Pipeline Language | `PipelineLanguageProvider` | pipeline JSON/JSONC + `default_pipeline.json` | 10 | [pipeline.md](pipeline.md) |

所有 Provider 在 [index.ts](../../../pkgs/extension/src/service/index.ts) 中统一创建并初始化。

## 公共基础设施

### 动态注册机制

两个基类都采用 DocumentFilter 动态更新策略——当用户切换工作区或 interface 导入变化时，先 `dispose` 旧 provider，再以新的 `DocumentFilter[]` 重新注册：

```
rootService.onActiveResourceChanged ──┐
                                      ├──→ updateProvider() → 重新注册到新文件范围
interfaceService.onInterfaceImportChanged ──┘
```

**Interface 体系 filter 范围**：当前 root 下的 `interface.json` + 所有 import 文件

**Pipeline 体系 filter 范围**：所有 resource 路径下的 `**/*.{json,jsonc}` + `default_pipeline.json` + interface 文件 + import 文件 + locale 文件

### 数据刷新

- **InterfaceProvider.flush()** → `interfaceBundle.flush()`（仅 interface 层）
- **PipelineProvider.flush()** → `interfaceBundle.flush(true)`（含 pipeline 层递归刷新）

`flushIndex()` 返回 `.info` 字段供后续匹配使用。

### 声明/引用查找

两个基类各自实现 `makeDecls()` 和 `makeRefs()`：

| 光标位置 | 返回 |
|---|---|
| 在 decl 上 | 同名声明 + 所有引用该声明的 ref |
| 在 ref 上 | 目标声明（+ 同名 ref，仅 Reference 能力） |

### 坐标转换

[utils.ts](../../../pkgs/extension/src/service/language/utils.ts) 提供 JSONC parser 的 AST Node（offset+length）到 VSCode Range/Location 的桥接函数：`convertRange`、`convertRangeWithDelta`、`convertRangeLocation`、`autoConvertRangeLocation`。

## 能力注册矩阵

| VSCode API | Interface | Pipeline |
|---|---|---|
| `registerCompletionItemProvider` | ✅ | ✅ |
| `registerHoverProvider` | ✅（骨架） | ✅ |
| `registerDefinitionProvider` | ✅ | ✅ |
| `registerReferenceProvider` | ✅ | ✅ |
| `registerCodeLensProvider` | ✅ | ✅ |
| `registerDocumentLinkProvider` | ✅ | ✅ |
| `registerCodeActionsProvider` | — | ✅ |
| `registerColorProvider` | — | ✅ |
| `registerInlayHintsProvider` | — | ✅ |
| `registerWorkspaceSymbolProvider` | — | ✅ |

## 通用模式

### 懒加载文档

Completion 项在 `provideCompletionItems` 阶段只设置回调（`fillDetail` / `fillTaskDetail`），在 `resolveCompletionItem` 阶段才执行回调获取完整 hover 内容。避免对大量补全项预加载的性能开销。

### Debounce 刷新

CodeLens 和 InlayHint Provider 使用 50ms debounce 合并高频事件，避免频繁重新渲染。

### 废弃处置

所有 Provider 通过 `DisposableHelper.defer` 注册清理回调。active resource 变化时自动 dispose → 重建。

### MAA 双模式

Pipeline 体系在以下维度分支处理 `isMaaAssistantArknights`：
- 触发字符（`"@#+^(` vs `"[]$`）
- 任务名解析（`task@sub` 命名空间 vs 扁平命名）
- 后缀约定（`tasks` vs `pipeline`、`template` vs `image`）
- 算法字段名（`algorithm` vs `recognition`）

## 数据流

```
InterfaceBundle (maa-pipeline-manager)
  ├── .info                     → InterfaceInfo (decls + refs)
  │   ├── .layer                → LayerInfo（层级化信息）
  │   │   ├── .mergedDecls      → 当前层声明
  │   │   ├── .mergedRefs       → 当前层引用
  │   │   ├── .mergedAllDecls   → 递归合并所有层声明
  │   │   ├── .mergedAllRefs    → 递归合并所有层引用
  │   │   └── .tasks            → 按名称索引的任务信息
  │   └── .langBundle           → 多语言数据
  │       ├── .allKeys()        → 所有 locale key
  │       ├── .queryKey(key)    → 按 key 查询各语言值
  │       └── .addPair(k,v)     → 添加翻译对
  ├── .topLayer                 → 顶层 LayerInfo（跨层查询入口）
  ├── .flush() / .flush(true)   → 重新解析
  └── .locateLayer(file)        → 定位文件所属 [layer, file, isDefault]
```

Provider 通过 `findDeclRef(decls/refs, offset)` 定位光标所在 AST 节点，节点类型决定后续分支。

## 参见

- [Interface Language Provider 策略](interface.md)
- [Pipeline Language Provider 策略](pipeline.md)
- [Extension 技术架构](../../extension/tech/README.md)
- [Extension 产品定义](../../extension/models/README.md)
- [Pipeline 语法双轨制](../pipeline-syntax.md)
