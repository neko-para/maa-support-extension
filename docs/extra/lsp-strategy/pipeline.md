# Pipeline Language Provider 策略

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

服务于 pipeline JSON/JSONC 文件的语言特性。所有 Provider 继承自 `PipelineLanguageProvider`（[base.ts](../../../pkgs/extension/src/service/language/pipeline/base.ts)）。

Pipeline 体系比 Interface 体系更复杂：需要处理层级化 Layer 结构，且区分 MaaFramework 和 MaaAssistantArknights（🄼）两种模式。

## 基类能力

### makeDecls / makeRefs

与 Interface 基类类似，但处理更丰富的节点类型：

**makeDecls 匹配规则**：

| decl 类型       | 匹配键          |
| --------------- | --------------- |
| `task.decl`     | `task`          |
| `task.anchor`   | `anchor`        |
| `task.sub_reco` | `name` + `task` |
| `task.locale`   | `key`           |

| ref 类型                         | 查找的目标 decl 类型                            |
| -------------------------------- | ----------------------------------------------- |
| 含 task 的 ref（且 target 存在） | `task.decl`（按 `ref.target`）                  |
| anchor ref                       | `task.anchor`（按 `ref.target`）                |
| `task.roi`                       | `task.sub_reco`（按 `ref.target` + `ref.task`） |
| `task.locale`                    | `task.locale`（按 `ref.target`）                |

**makeRefs 匹配规则**：查找引用某 task 的所有 ref，需排除 Anchor 间接引用和 ROI prev 引用。

### 辅助方法

| 方法                                  | 用途                                                  |
| ------------------------------------- | ----------------------------------------------------- |
| `evalTask(intBundle, task, current?)` | 求值任务配置（MAA 模式用 `@` 拼接，通用模式直接求值） |
| `getTaskRecoAct(...)`                 | 获取任务的 [识别算法, 动作] 对                        |
| `getTaskBrief(...)`                   | 获取任务简要信息（算法 + 动作 + 文档）                |
| `getTaskHover(...)`                   | 获取任务完整 hover（源码、合并结果、模板图片）        |
| `getImageHover(...)`                  | 获取图片预览（含文件链接和嵌入图片）                  |
| `getLocaleHover(target)`              | 查询多语言翻译值，生成 markdown 表格                  |
| `makeMaaDecls(decls, task)`           | 🄼 在所有 decl 中定位 task 的每次出现                  |
| `makeMaaRefs(refs, task)`             | 🄼 在所有 ref 中定位 task 的每次引用                   |

---

## 各能力详述

### Completion（[completion.ts](../../../pkgs/extension/src/service/language/pipeline/completion.ts)）

**触发字符**：

- MaaFramework: `"[]$`
- 🄼 MaaAssistantArknights: `"@#+^(`

**处理流程**：

#### Step 1: 定位上下文

`intBundle.locateLayer()` → 获取 layer + file → `findDeclRef()` 定位 decl/ref

#### Step 2: Anchor 声明补全

光标在 `task.anchor` decl 上 → 列出 layer 中所有 anchor，排除自身。

#### Step 3: 按 ref 类型分支

##### 🄼 MAA 模式

| ref 类型             | 条件             | 补全                                                                      | kind         |
| -------------------- | ---------------- | ------------------------------------------------------------------------- | ------------ |
| `task.maa.base_task` | 在任务名位置     | 所有 task 名                                                              | `Class`      |
| `task.maa.expr`      | `@` 后或普通字符 | 所有 task 名                                                              | `Class`      |
| `task.maa.expr`      | 非 `@` 后        | `#none, #self, #sub, #exceeded_next, #on_error_next, #reduce_other_times` | `EnumMember` |
| `task.maa.expr`      | `#` 后           | 以上虚拟键（不带 `#`）                                                    | `EnumMember` |

**任务名部分匹配**：`findTaskWordRange()` 向后扫描 `[a-zA-Z0-9_-]`，实现输入部分名称时替换整个词。

##### MaaFramework 模式

| ref 类型                                 | 条件        | 补全内容                               | sortText    |
| ---------------------------------------- | ----------- | -------------------------------------- | ----------- |
| `task.next`（obj 模式，无 Anchor）       | —           | task 名                                | `1_`        |
| `task.next`（obj 模式，有 Anchor）       | —           | anchor 名                              | 无前缀      |
| `task.next`（非 obj）                    | 无 JumpBack | `[JumpBack]`                           | `0_`        |
| `task.next`（非 obj）                    | 无 Anchor   | `[Anchor]`                             | `2_`        |
| `task.next`（非 obj）                    | 有 Anchor   | anchor 名                              | `1_`        |
| `task.next`（非 obj）                    | 无 Anchor   | task 名                                | `1_`        |
| `task.anchor`                            | —           | anchor 名                              | 无前缀      |
| `task.reco`                              | —           | task 名                                | `1_`        |
| `task.color_filter`                      | —           | 仅 `Reco=ColorMatch` 的 task           | `1_`        |
| `task.custom_task`                       | —           | task 名                                | `1_`        |
| `task.entry`                             | —           | task 名                                | `1_`        |
| `task.roi`                               | —           | subName 历史值 (`0_`) + task 名 (`1_`) | 历史值优先  |
| `task.target`                            | —           | 同 `task.next`（非 obj）               | —           |
| `task.template` / `task.custom_template` | —           | imageFolder (`0_`) + image 列表 (`1_`) | folder 优先 |
| `task.locale`                            | —           | `langBundle.allKeys()`                 | —           |

**补全项特殊机制**：

- **连续补全**：`task.next`（非 obj）和 `task.target` 中选择 `[JumpBack]`/`[Anchor]` 后，通过 `command: TriggerCompletion` 自动触发下一次补全
- **range 扩展**：带 attributes 的 ref（如 `task.next`）range 右边界额外扩展 `ref.attrs.offset`
- **懒加载文档**：`fillTaskDetail` → `resolveCompletionItem` 中调用 `getTaskBrief()`

---

### Hover（[hover.ts](../../../pkgs/extension/src/service/language/pipeline/hover.ts)）

**策略**：

| 光标位置                                 | 显示内容                                            |
| ---------------------------------------- | --------------------------------------------------- |
| `task.decl`                              | 任务详情（JSON 源码片段 + 合并配置 + 模板图片预览） |
| `task.locale`（decl）                    | 各语言翻译值表格                                    |
| 🄼 `task.maa.base_task` / `task.maa.expr` | `findMaaDeclRef()` 定位具体 task → 任务详情         |
| 含 task 的其他 ref                       | `extractTaskRef()` 提取 → 任务详情                  |
| `task.template` / `task.custom_template` | 模板图片预览                                        |
| `task.locale`（ref）                     | 各语言翻译值表格                                    |

**`getTaskHover()` 构建**：Layer 源码定义 → 合并后的 eval 结果 JSON → 模板匹配算法时附加图片预览。

**`getImageHover()`**：非 MAA 且不以 `.png` 结尾 → 展示 image folder 信息；否则展示具体图片文件链接和嵌入预览。

**`getLocaleHover()`**：遍历所有语言文件查询 key 的值，输出 markdown 表格（含源文件行号链接）。

---

### Definition（[definition.ts](../../../pkgs/extension/src/service/language/pipeline/definition.ts)）

**🄼 MAA 模式**：

1. `findMaaDeclRef()` 定位到具体 taskRef（处理 `task@sub` 命名空间）
2. `makeMaaDecls()` 在所有 decl 中查找该 task
3. 在 decl 上时额外调用 `makeMaaRefs()` 查找引用
4. 处理 `taskSuffix !== task` 情况（短路名 + 全名均查找）

**MaaFramework 模式**：

1. decl 上 → `makeDecls() + makeRefs()` 并集
2. ref 上 → 仅 `makeDecls()`
3. **特殊规则**：`default_pipeline.json` 中的 `task.decl` 返回 null（避免跳转到框架内置定义）

---

### Reference（[reference.ts](../../../pkgs/extension/src/service/language/pipeline/reference.ts)）

**策略**：与 Definition 对称，但始终返回 `makeDecls() + makeRefs()` **并集**。

- 🄼 MAA 模式额外调用 `makeMaaRefs()`
- `default_pipeline.json` 中的 `task.decl` 同样被过滤

---

### CodeLens（[codeLens.ts](../../../pkgs/extension/src/service/language/pipeline/codeLens.ts)）

**刷新**：debounce(50ms)，监听 interface/resource/config 变化。

**策略**：遍历文件中所有 task 声明，为每个 task 生成 CodeLens：

| 模式         | 按钮        | 命令                                                |
| ------------ | ----------- | --------------------------------------------------- |
| MaaFramework | "▶ Launch"  | `commands.LaunchTask`                               |
| MaaFramework | "🔗 N refs" | `commands.FindTaskRef`（N = 全 workspace 引用计数） |
| 🄼 MAA        | "Evaluate"  | `commands.EvalTask`                                 |

- **`isDefault` 文件不显示** CodeLens
- **引用计数**：扫描 `topLayer.mergedAllRefs`，通过 `extractTaskRef` 提取 task 名后用 Map 统计，是精确的跨文件计数

---

### CodeActions（[codeActions.ts](../../../pkgs/extension/src/service/language/pipeline/codeActions.ts)）

**触发**：仅在有 Selection（非普通 Range）时处理。

| 光标位置          | 操作                                | Kind              |
| ----------------- | ----------------------------------- | ----------------- |
| `task.decl`       | "切换为 V1 格式" / "切换为 V2 格式" | `RefactorRewrite` |
| `task.can_locale` | "提取到 locale"                     | `RefactorExtract` |

**格式切换**：找到 task 的 prop 和 data 范围 → `layer.toggleMode(1/2, info, indent)` → `WorkspaceEdit.replace`

**Locale 提取**：

1. 弹出输入框输入 locale key（校验唯一性）
2. `langBundle.addPair(key, value)` → 返回编辑动作列表
3. 两种编辑动作：`replace`（覆写文件）或 `insert`（在 offset 处插入）
4. 原文本替换为 `"$key"` 引用

---

### DocumentLink（[documentLink.ts](../../../pkgs/extension/src/service/language/pipeline/documentLink.ts)）

**策略**：

| ref 类型                                 | 条件                        | 链接目标                             |
| ---------------------------------------- | --------------------------- | ------------------------------------ |
| `task.can_locale` / `task.locale_text`   | target 以 `.md`/`.png` 结尾 | `joinPath(topLayer.root, target)`    |
| `task.template` / `task.custom_template` | 以 `.png` 结尾              | `topLayer.getImage()` 第一个匹配文件 |
| `task.template` / `task.custom_template` | 非 `.png` 且非 MAA          | `imageFolders` 第一个匹配目录        |

**关键**：`.png` 模板只取 `getImage()` 的最顶层匹配（`break` 跳出）。

---

### DocumentColor（[color.ts](../../../pkgs/extension/src/service/language/pipeline/color.ts)）

**策略**：遍历 `task.color` 类型 ref：

- 读取 `ref.color`（`[R, G, B]`）
- `ref.method === 'hsv'` 时调用 `hsv2rgb()` 转换
- 返回 `ColorInformation`（VSCode 渲染颜色方块）

`provideColorPresentations` 返回空数组（不支持颜色编辑回写）。

---

### InlayHint（[inlayHint.ts](../../../pkgs/extension/src/service/language/pipeline/inlayHint.ts)）

**刷新**：debounce(50ms)，额外监听 `onLocaleChanged`。

**策略**：在可见范围（`range` 参数限制）内提供两种内联提示：

1. **Locale 翻译值** — `task.locale` 的 ref 后显示当前首选语言的值（`langBundle.queryKey()[preferredIndex]`）
2. **Task 文档** — 含 task 的 ref 后显示 `layer.getTaskDoc(task)` 的文档文本

两者均过滤 null 后返回。

---

### WorkspaceSymbol（[workspaceSymbol.ts](../../../pkgs/extension/src/service/language/pipeline/workspaceSymbol.ts)）

**注册**：不通过 DocumentFilter，直接 `registerWorkspaceSymbolProvider`。

**策略**：

1. 扫描 `info.layer.mergedAllDecls` 中所有 `task.decl`
2. 跳过 `$` 开头的 task（内部/隐藏）
3. `query.toLowerCase().indexOf(task.toLowerCase())` 匹配
4. containerName = `文件名:行号`

---

## 参见

- [LSP 策略总览](README.md)
- [Interface Language Provider 策略](interface.md)
- [Pipeline 语法双轨制](../pipeline-syntax.md)
