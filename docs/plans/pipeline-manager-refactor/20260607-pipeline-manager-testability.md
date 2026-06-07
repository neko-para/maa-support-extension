# Pipeline Manager — 可测试性设计

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 一、当前障碍

核心重构（[core-redesign](./20260607-pipeline-manager-core-redesign.md)）完成后，`core/` 下的所有模块将是纯逻辑、零平台依赖的。这为测试扫清了最大障碍。但仍有几个具体问题需要设计：

1. **AST 输入构造**：parser 输入是 `Node`，通过 `parseTreeWithoutParent(jsonString)` 从 JSON 获取真实 AST 即可，无需手写 fixture
2. **品牌化类型**：`TaskName`、`AbsolutePath` 等需要 `as` 断言
3. **LayerInfo 的复杂状态**：需要为 query/matching 模块构造多层 Layer 数据

## 二、测试分层

```
┌─ 集成测试 (少量) ───────────────────────────┐
│  完整流程：文件 → 解析 → 符号图 → 匹配        │
│  使用 io/ 读取真实 fixture 文件               │
├─ 单元测试 (主体) ────────────────────────────┤
│  每个 core 模块的独立测试                     │
│  使用 AST fixture 或 mock Layer              │
├─ 快照测试 (辅助) ────────────────────────────┤
│  parser 输出、diagnostic 输出的回归验证       │
└──────────────────────────────────────────────┘
```

## 三、Parser 输入构造

`parseTask()` 和 `parseInterface()` 接受 `jsonc-parser` 的 `Node` 作为输入。测试中通过 `parseTreeWithoutParent(jsonString)` 直接从 JSON 字符串获取真实 AST，无需手动拼装 Node。

```typescript
import { parseTreeWithoutParent } from '@nekosu/maa-pipeline-manager'

function parseTaskFromJson(json: string, taskName: string) {
  const tree = parseTreeWithoutParent(json)
  const taskProp = tree.children[0]
  const obj = taskProp.children[1]
  const key = taskProp.children[0]

  return parseTask(obj, {
    maa: false,
    file: '/test/pipeline.json' as AbsolutePath,
    task: key,
    taskName: taskName as TaskName
  })
}
```

手动构造 Node 仅在测试**畸形输入**时需要（如故意缺少 `children` 的 Node 验证防御性代码），场景极少。

## 四、Parser 测试策略

### parseTask

| 测试维度      | 验证点                              |
| ------------- | ----------------------------------- |
| 每种 ref type | 正确的 type discriminant、target 值 |
| 空值          | 无 ref 时返回空数组                 |
| 边界值        | 特殊字符 task name、空字符串        |
| objMode       | `next` 的对象格式                   |
| MAA 模式      | `baseTask`、`@` 表达式              |
| 自定义 parser | `customReco`/`customAction` 注入    |

```typescript
describe('parseTask — next', () => {
  test('string array', () => {
    const info = parseTaskFromJson('{ "T": { "next": ["A", "B"] } }', 'T')
    expect(info.refs).toMatchObject([
      { type: 'task.next', target: 'A', objMode: false },
      { type: 'task.next', target: 'B', objMode: false }
    ])
  })

  test('with [Anchor] prefix', () => {
    const info = parseTaskFromJson('{ "T": { "next": "[Anchor]A" } }', 'T')
    const ref = info.refs[0]
    expect(ref.attrs.attrs.Anchor).toBe(true)
    expect(ref.target).toBe('A')
  })

  test('obj mode', () => {
    const info = parseTaskFromJson('{ "T": { "next": { "name": "A" } } }', 'T')
    expect(info.refs[0].objMode).toBe(true)
  })
})
```

### parseInterface

| 测试维度          | 验证点                                                  |
| ----------------- | ------------------------------------------------------- |
| 每种 decl type    | controller/resource/group/task/option/case/input/preset |
| 每种 ref type     | 对应的引用提取                                          |
| import 过滤       | `ctx.import=true` 时仅解析 option/task/preset           |
| pipeline_override | extraDecls/extraRefs 生成                               |

## 五、Matching 模块测试

从 LSP `base.ts` 移入 `core/matching/` 的函数是纯数据变换，最易测试：

```typescript
describe('extractTaskRef', () => {
  test('returns target for task.next without Anchor', () => {
    const ref = { type: 'task.next', target: 'TaskA', objMode: false, attrs: { offset: 0, attrs: {}, unknown: [] } }
    expect(extractTaskRef(ref)).toBe('TaskA')
  })

  test('returns null for task.next with Anchor', () => {
    const ref = { type: 'task.next', target: 'TaskA', objMode: false, attrs: { offset: 8, attrs: { Anchor: true }, unknown: [] } }
    expect(extractTaskRef(ref)).toBeNull()
  })
})

describe('findMatchingDecls', () => {
  test('task ref → finds matching task.decl', () => {
    const decls = [{ type: 'task.decl', task: 'TaskA', ... }]
    const ref = { type: 'task.next', target: 'TaskA', objMode: false, attrs: { offset: 0, attrs: {}, unknown: [] } }
    const result = findMatchingDecls(decls, [], null, ref)
    expect(result).toHaveLength(1)
  })
})
```

## 六、Layer/LayerTree 测试

拆分后的 `TaskStore` 和 `Layer` 可独立测试：

```typescript
describe('TaskStore', () => {
  test('add and get', () => {
    const store = new TaskStore()
    store.add('TaskA' as TaskName, mockTaskInfo())
    expect(store.get('TaskA' as TaskName)).toHaveLength(1)
  })

  test('removeFile', () => {
    const store = new TaskStore()
    store.add('TaskA' as TaskName, { ...mockTaskInfo(), file: '/a.json' })
    store.add('TaskB' as TaskName, { ...mockTaskInfo(), file: '/b.json' })
    store.removeFile('/a.json' as AbsolutePath)
    expect(store.list()).toEqual(['TaskB'])
  })
})

describe('LayerTree', () => {
  test('mergedDecls includes parent', () => {
    const parent = new Layer('/parent')
    parent.tasks.add('TaskA', mockTaskInfoWithDecls([{ type: 'task.decl', task: 'TaskA' }]))

    const child = new Layer('/child')
    child.parent = parent
    child.tasks.add('TaskB', mockTaskInfoWithDecls([{ type: 'task.decl', task: 'TaskB' }]))

    const tree = new LayerTree(child)
    expect(tree.mergedDecls()).toHaveLength(2)
  })
})
```

## 七、Diagnostic 测试

诊断函数接受 `InterfaceBundle`，但重构后应改为接受纯数据结构：

```typescript
// 重构前
function checkTask(bundle: InterfaceBundle): Diagnostic[]

// 重构后
function checkTask(state: ProjectState): Diagnostic[]
// 或更精确
function checkTask(layers: Layer[], decls: TaskDeclInfo[], refs: TaskRefInfo[]): Diagnostic[]
```

```typescript
describe('checkTask — unknown-task', () => {
  test('ref to non-existent task', () => {
    const decls = [{ type: 'task.decl', task: 'ExistingTask', file: '/a.json', ... }]
    const refs = [{ type: 'task.next', target: 'MissingTask', file: '/a.json', ... }]

    const diags = checkTaskRefs(decls, refs)
    expect(diags).toContainEqual(
      expect.objectContaining({ type: 'unknown-task', task: 'MissingTask' })
    )
  })
})
```

诊断测试验证**结构化数据**（`type`、`task`、`offset` 等），不验证消息文案。文案生成是展示层（LSP/locale）的职责，应在其所在包中单独测试。

## 八、测试框架建议

| 选择        | 理由                                                            |
| ----------- | --------------------------------------------------------------- |
| `vitest`    | 与 Vite 生态一致（webview 已用 Vite），原生 ESM，快，watch mode |
| `node:test` | Node 内置，零依赖                                               |

推荐 `vitest`——webview 已在使用，且它的 fixture 加载、snapshot 等能力更丰富。

## 九、CI 集成

```yaml
# .github/workflows/test.yml
- name: Test core
  run: pnpm -C pkgs/maa-pipeline-manager test

- name: Test with MAA fixtures
  run: pnpm -C pkgs/maa-pipeline-manager test:maa
```

MAA fixture 需要 `@maaxyz/maa-node` 类型，可作为 optional 测试依赖。
