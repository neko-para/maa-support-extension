# Pipeline Completion 重构方案

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 目标

降低 `pipeline/completion.ts` 的代码复杂度，模仿 definition/reference 的成功模式（提取 `makeDecls`/`makeRefs` 收拢核心策略），让 Provider 变为薄封装。

**不动**：MAA 侧、Interface 侧、TODO-25（可选后续增强）。

## 现状问题

[completion.ts](../../../pkgs/extension/src/service/language/pipeline/completion.ts) `provideCompletionItems` ~150 行，核心 5 路 if-else：

| 分支     | 条件                                                                               | 补全内容                         | 特殊点                             |
| -------- | ---------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------- |
| Branch 1 | `next`(obj,!A) / `anchor`(ref) / `reco` / `color_filter` / `custom_task` / `entry` | task name                        | `color_filter` 额外过滤 ColorMatch |
| Branch 2 | `next`(obj,A) / `custom_anchor`                                                    | anchor name                      | —                                  |
| Branch 3 | `next`(!obj) / `roi` / `target`                                                    | 前缀 + task/anchor + roi subName | 最复杂分支，~70 行                 |
| Branch 4 | `template` / `custom_template`                                                     | image folder + file              | —                                  |
| Branch 5 | `locale`                                                                           | locale key                       | early return，结构不同             |

痛点：

1. 条件表达式混合 type + 运行时属性（`objMode`、`attrs.Anchor`、`attrs.JumpBack`），可读性差
2. 同一 `task.next` 散落在 3 个分支中
3. 前缀补全、核心补全、来源特有附加——三个关注点交织

## CompletionSpec 类设计

### 核心洞察：两种模式 + 少量特殊配置

分析所有 ref type 的补全行为，可以归为两类：

**对象模式** — ref 的值来自 JSON 对象的 key/value 结构。无前缀补全，range 始终 `±1`。覆盖 12/17 个 type。

**字符串模式** — ref 的值是 JSON 字符串，可能带 `[Anchor]`/`[JumpBack]` 前缀。有前缀补全，range 需跳过前缀偏移。覆盖 3 个 type（`next`、`target`、`roi`）。

在这两种模式之上，只有 **2 个特殊配置**：

1. `color_filter` 需要过滤 ColorMatch 任务（唯一需要 `taskFilter` 的 type）
2. `locale` 的 range 是 `±2`（`$key` 比普通字符串多一个 `$`）

### 属性分层

```
┌──────────────────────────────────────────────────┐
│ 关键属性（每个 spec 都有）                          │
│   kind:    'task' | 'anchor' | 'image' | 'locale' │
│   isStringMode: boolean                           │
│   rangeExpandRight: number                        │
│   prefixOptions: string[]                         │
├──────────────────────────────────────────────────┤
│ 特殊配置（仅个别 case 设置）                        │
│   taskFilter?: (info) => boolean   ← color_filter │
└──────────────────────────────────────────────────┘
```

`isStringMode` **派生** `rangeExpandRight` 和 `prefixOptions` 的默认值，工厂方法封装此逻辑。

### 静态工厂

工厂按**语义意图**命名，让调用点一眼看出补全策略：

```typescript
class CompletionSpec {
  readonly kind: 'task' | 'anchor' | 'image' | 'locale'
  readonly isStringMode: boolean
  readonly prefixOptions: readonly string[]
  readonly rangeExpandRight: number
  readonly taskFilter?: (info: TaskBriefInfo) => boolean

  private constructor(/* ... */) {
    /* ... */
  }

  // ── 对象模式：简单名称补全 ──────────────────

  /** 补全 task name。覆盖：anchor(ref), reco, custom_task, entry, next(obj,!A) */
  static task(): CompletionSpec

  /** 补全 anchor name。覆盖：custom_anchor, next(obj,A) */
  static anchor(): CompletionSpec

  // ── 字符串模式：名称补全 + 前缀选项 ──────────

  /**
   * 补全 task name，支持 [Anchor]/[JumpBack] 前缀。
   * @param attrs  当前 ref 的属性（提供 offset）
   * @param prefixes  可用的前缀类型：['Anchor'] 或 ['JumpBack','Anchor']
   * 覆盖：target(!A), roi(!A), next(!obj,J,!A), next(!obj,!J,!A)
   */
  static taskWithPrefix(
    attrs: TaskAttrInfo<'JumpBack' | 'Anchor'>,
    prefixes: ('JumpBack' | 'Anchor')[]
  ): CompletionSpec

  /**
   * 补全 anchor name（[Anchor] 前缀已在值中）。
   * 覆盖：next(!obj,A), target(A), roi(A)
   */
  static anchorWithPrefix(attrs: TaskAttrInfo<'Anchor'>): CompletionSpec

  // ── 非名称补全 ─────────────────────────────

  /** 补全 image 路径。覆盖：template, custom_template */
  static image(): CompletionSpec

  /** 补全 locale key。覆盖：locale */
  static locale(): CompletionSpec

  // ── 修饰器 ────────────────────────────────

  /** 添加 ColorMatch 过滤（仅 color_filter 使用） */
  withColorMatchFilter(): CompletionSpec
}
```

### 工厂参数选择

`taskWithPrefix` 接受显式的 `prefixes` 参数而非从 ref 推导——因为同样 `!Anchor` 条件下，`next` 可选 `['JumpBack','Anchor']`，而 `target`/`roi` 只能选 `['Anchor']`。这是**来源字段的固有差异**，无法从 attrs 推导。显式传入让调用点的意图更清晰。

`anchorWithPrefix` 不需要 `prefixes` 参数——Anchor 前缀已存在时，永远不需要再补全前缀。

### resolveCompletionSpec 调用点

每个 ref type 只出现一次，工厂名直接表达意图：

```typescript
private resolveCompletionSpec(ref: TaskRefInfo): CompletionSpec | null {
  switch (ref.type) {
    // ── 字符串模式 ──────────────────────────
    case 'task.next':
      if (ref.objMode) {
        return ref.attrs.attrs.Anchor
          ? CompletionSpec.anchor()
          : CompletionSpec.task()
      }
      if (ref.attrs.attrs.Anchor) {
        return CompletionSpec.anchorWithPrefix(ref.attrs)
      }
      return CompletionSpec.taskWithPrefix(
        ref.attrs,
        ref.attrs.attrs.JumpBack ? ['Anchor'] : ['JumpBack', 'Anchor']
      )

    case 'task.target':
      return ref.attrs.attrs.Anchor
        ? CompletionSpec.anchorWithPrefix(ref.attrs)
        : CompletionSpec.taskWithPrefix(ref.attrs, ['Anchor'])

    case 'task.roi':
      return ref.attrs.attrs.Anchor
        ? CompletionSpec.anchorWithPrefix(ref.attrs)
        : CompletionSpec.taskWithPrefix(ref.attrs, ['Anchor'])

    // ── 对象模式：简单名称 ────────────────────
    case 'task.anchor':
      return CompletionSpec.task()

    case 'task.reco':
      return CompletionSpec.task()

    case 'task.custom_task':
      return CompletionSpec.task()

    case 'task.entry':
      return CompletionSpec.task()

    case 'task.custom_anchor':
      return CompletionSpec.anchor()

    // ── 特殊配置 ─────────────────────────────
    case 'task.color_filter':
      return CompletionSpec.task().withColorMatchFilter()

    // ── 非名称补全 ───────────────────────────
    case 'task.template':
    case 'task.custom_template':
      return CompletionSpec.image()

    case 'task.locale':
      return CompletionSpec.locale()

    default:
      return null
  }
}
```

要点：

- 常见模式一眼可辨：`CompletionSpec.task()` 一行收工（6 个 case）
- 特殊配置视觉突出：`.withColorMatchFilter()` 链式调用仅 1 处
- `target` 和 `roi` 的 Anchor/!Anchor 分叉结构完全一致，阅读时可快速跳过
- `next` 是最复杂的 type，但所有逻辑集中在 1 个 `case` 块内（~10 行）

### buildCompletionItems —— 按关注点分离的组装逻辑

```typescript
private buildCompletionItems(
  ref: TaskRefInfo,
  spec: CompletionSpec,
  layer: LayerInfo,
  intBundle: InterfaceBundle,
  document: vscode.TextDocument
): CustomCompletionItem[] {
  const items: CustomCompletionItem[] = []

  // 统一 range 计算
  const range = convertRangeWithDelta(document, ref.location, -1, spec.rangeExpandRight)
  const isSingleChar = range.start.line === range.end.line
                    && range.start.character === range.end.character
  const triggerNext = spec.isStringMode && isSingleChar
    ? { command: commands.TriggerCompletion, title: 'trigger next' }
    : undefined

  // ── 关注点 1: 前缀补全（仅字符串模式） ──
  for (const prefix of spec.prefixOptions) {
    items.push({
      label: `[${prefix}]`,
      kind: vscode.CompletionItemKind.Property,
      range: new vscode.Range(range.start, range.start),
      sortText: prefix === 'JumpBack' ? '0_JumpBack' : '2_Anchor',
      command: triggerNext
    })
  }

  // ── 关注点 2: 核心补全 ──
  switch (spec.kind) {
    case 'task':
      for (const task of layer.getTaskList()) {
        if (spec.taskFilter) {
          const info = layer.getTaskBriefInfo(task)
          if (!spec.taskFilter(info)) continue
        }
        items.push({
          label: task,
          kind: vscode.CompletionItemKind.Class,
          range,
          sortText: '1_' + task,
          fillTaskDetail: () => this.getTaskBrief(intBundle, task)
        })
      }
      break

    case 'anchor': {
      const anchors = [...new Set(layer.getAnchorList().map(([a]) => a))]
      for (const anchor of anchors) {
        items.push({
          label: anchor,
          kind: vscode.CompletionItemKind.Variable,
          range,
          sortText: spec.isStringMode ? '1_' + anchor : anchor
        })
      }
      break
    }

    case 'image':
      for (const [folder] of layer.getImageFolders()) {
        items.push({
          label: folder + '/',
          kind: vscode.CompletionItemKind.Folder,
          range,
          sortText: '0_' + folder + '/'
        })
      }
      for (const image of layer.getImageList()) {
        items.push({
          label: image,
          kind: vscode.CompletionItemKind.File,
          range,
          sortText: '1_' + image
        })
      }
      break

    case 'locale':
      // 保持 early return — item 结构不同（insertText + fillDetail）
      return intBundle.langBundle.allKeys().map(name => {
        const esc = JSON.stringify(name)
        return {
          label: name,
          kind: vscode.CompletionItemKind.Constant,
          insertText: esc.substring(1, esc.length - 1),
          range,
          fillDetail: async () => (await this.getLocaleHover(name)) ?? ''
        }
      })
  }

  // ── 关注点 3: ROI subName 历史（来源特有附加） ──
  if (ref.type === 'task.roi') {
    for (const subName of ref.prev) {
      items.push({
        label: subName.value,
        kind: vscode.CompletionItemKind.Reference,
        range,
        sortText: '0_' + subName.value
      })
    }
  }

  return items
}
```

三个关注点完全解耦：

1. **前缀补全**：仅依赖 `spec.prefixOptions` 和 `spec.isStringMode`
2. **核心补全**：仅依赖 `spec.kind`（+ 可选 `spec.taskFilter`）
3. **来源特有附加**：按 `ref.type` 直接判断（仅 roi 一处）

### 重构后的 provideCompletionItems

```typescript
async provideCompletionItems(
  document: vscode.TextDocument,
  position: vscode.Position,
  _token: vscode.CancellationToken,
  _context: vscode.CompletionContext
): Promise<CustomCompletionItem[] | null> {
  const intBundle = await this.flush()
  if (!intBundle) return null

  const layerInfo = intBundle.locateLayer(document.uri.fsPath as AbsolutePath)
  if (!layerInfo) return null
  const [layer, file] = layerInfo

  const offset = document.offsetAt(position)
  const decls = layer.mergedDecls.filter(decl => decl.file === file)
  const refs = layer.mergedRefs.filter(ref => ref.file === file)
  const decl = findDeclRef(decls, offset)
  const ref = findDeclRef(refs, offset)

  // 特殊：anchor decl 补全
  if (decl && decl.type === 'task.anchor') {
    return this.completeAnchorDecl(decl, decls, layer, document)
  }

  if (!ref) return null

  // MAA 模式（保持不变）
  if (isMaaAssistantArknights) {
    return this.completeMaa(ref, layer, document, offset, intBundle)
  }

  // 核心：spec 驱动
  const spec = this.resolveCompletionSpec(ref)
  if (!spec) return null

  return this.buildCompletionItems(ref, spec, layer, intBundle, document)
}
```

## 效果对比

| 维度                      | 当前                               | 重构后                                                |
| ------------------------- | ---------------------------------- | ----------------------------------------------------- |
| `provideCompletionItems`  | ~150 行                            | ~35 行                                                |
| 分支结构                  | 5 路 if-else，条件含 2-3 个 clause | spec lookup + kind switch（2 层）                     |
| 理解 "next 补全什么"      | 跨 3 个分支搜索                    | `resolveCompletionSpec` 的 `task.next` case（~10 行） |
| 理解 "task name 怎么补全" | 在多个分支中找 task 补全代码       | `buildCompletionItems` 的 `case 'task'` 块            |
| 新增 ref type             | 添加条件表达式 + range + item      | `resolveCompletionSpec` 中 1 行工厂调用               |
| 修改前缀行为              | 定位到 Branch 3 的条件段           | `spec.prefixOptions` 驱动，改动点明确                 |
| 关注点耦合                | 前缀 + 核心 + 附加交织             | 三个独立步骤，顺序执行                                |

## 与 makeDecls/makeRefs 的架构一致性

| 能力           | 核心策略                                             | Provider 角色        |
| -------------- | ---------------------------------------------------- | -------------------- |
| Definition     | `makeDecls` / `makeRefs`                             | 调用 + 组装 Location |
| Reference      | `makeDecls` / `makeRefs`                             | 调用 + 组装 Location |
| **Completion** | **`resolveCompletionSpec` + `buildCompletionItems`** | **调用 + 返回**      |

## 文件组织

```
pipeline/
├── completion.ts            # 新逻辑 + Provider 入口（开关路由）
└── completion-legacy.ts     # 旧逻辑（自由函数，this 注入）
```

### completion-legacy.ts —— 历史逻辑

当前 `provideCompletionItems` 的完整实现提取到此文件，改为**自由函数**，使用 TypeScript 的 `this` 参数声明对 Provider 的依赖：

```typescript
// completion-legacy.ts
import type { PipelineCompletionProvider } from './completion'

/**
 * 历史补全逻辑（重构前的 provideCompletionItems 实现）。
 * 通过 this 参数访问 Provider 成员。
 */
export async function provideCompletionItemsLegacy(
  this: PipelineCompletionProvider,
  document: vscode.TextDocument,
  position: vscode.Position,
  token: vscode.CancellationToken,
  context: vscode.CompletionContext
): Promise<CustomCompletionItem[] | null> {
  // ... 原有 ~150 行逻辑，保持不变 ...
  // 内部通过 this.flush() / this.getTaskBrief() 等方法访问 Provider
}
```

### completion.ts —— 新逻辑 + 路由

`CompletionSpec` 类、`resolveCompletionSpec`、`buildCompletionItems` 保留为 Provider 的私有成员。入口方法通过 setting 开关路由到新旧逻辑：

```typescript
// completion.ts
import { provideCompletionItemsLegacy } from './completion-legacy'

export class PipelineCompletionProvider
  extends PipelineLanguageProvider
  implements vscode.CompletionItemProvider<CustomCompletionItem>
{
  // ... constructor 等 ...

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<CustomCompletionItem[] | null> {
    // ── 公共前置逻辑 ──
    const intBundle = await this.flush()
    if (!intBundle) return null
    // ... locateLayer, findDeclRef 等 ...

    // ── 路由 ──
    if (vscode.workspace.getConfiguration('maa').get('pipelineCompletionV2')) {
      const spec = this.resolveCompletionSpec(ref)
      if (!spec) return null
      return this.buildCompletionItems(ref, spec, layer, intBundle, document)
    }
    return provideCompletionItemsLegacy.call(this, document, position, token, context)
  }

  // ── V2 私有方法 ──
  private resolveCompletionSpec(ref: TaskRefInfo): CompletionSpec | null {
    /* ... */
  }
  private buildCompletionItems(ref, spec, layer, intBundle, document) {
    /* ... */
  }
}
```

关键点：

- 旧逻辑通过 `.call(this, ...)` 注入 `this`——函数体内 `this.flush()` 等工作如常
- 新逻辑作为私有方法，直接访问 `this`
- 公开的 `provideCompletionItems` 先执行公共前置逻辑，再根据 setting 分支

## 开关设计

```jsonc
{
  "maa.pipelineCompletionV2": true // false = 走 completion-legacy.ts
}
```

## 实施计划

### Phase 1：提取旧逻辑

1. 创建 `pipeline/completion-legacy.ts`
2. 将当前 `provideCompletionItems` 的方法体移入 `provideCompletionItemsLegacy` 自由函数，添加 `this: PipelineCompletionProvider` 参数
3. `completion.ts` 的 `provideCompletionItems` 改为委托调用 `provideCompletionItemsLegacy.call(this, ...)`
4. 验证行为不变（无开关，始终走旧逻辑）

### Phase 2：添加新逻辑 + 开关

1. 在 `completion.ts` 中添加 `CompletionSpec` 类、`resolveCompletionSpec`、`buildCompletionItems`
2. 在 `provideCompletionItems` 中添加 setting 开关路由
3. 默认 `false`，手动开启验证

### Phase 3：验证

手动测试各 ref type 的补全行为与重构前一致。重点关注：

- `next` 的 obj/string 模式切换 + JumpBack/Anchor 前缀
- `color_filter` 的 ColorMatch 过滤
- `roi` 的 subName 历史
- `locale` 的 insertText + fillDetail

### Phase 4：清理

确认无问题后删除 `completion-legacy.ts` 和开关，将 `buildCompletionItems` 等内容直接内联到 `provideCompletionItems`（或保留方法分离）。

## 参见

- [LSP 策略总览](../extra/lsp-strategy/README.md)
- [Pipeline Language Provider 策略](../extra/lsp-strategy/pipeline.md)
- [TODO-25](../../TODO.md) — 自定义解析器局限性（可选后续增强）
