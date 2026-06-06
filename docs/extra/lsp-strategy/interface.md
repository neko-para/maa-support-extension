# Interface Language Provider 策略

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

服务于 `interface.json` 及其 import 文件的语言特性。所有 Provider 继承自 `InterfaceLanguageProvider`（[base.ts](../../../pkgs/extension/src/service/language/interface/base.ts)）。

## 基类能力

### makeDecls / makeRefs

查找与给定 decl/ref 相关联的声明和引用。匹配规则：

| 类型种类 | 匹配键 |
|---|---|
| controller / resource / group / task / option | `name` |
| case / input | `name` + `option` |

### getLocaleHover(target)

在所有语言文件中查询给定的 locale key，生成 markdown 表格。每行包含：语言名（带文件链接）、翻译值（或 `<missing>`）。

---

## 各能力详述

### Completion（[completion.ts](../../../pkgs/extension/src/service/language/interface/completion.ts)）

**触发字符**: `"`

**策略**：
1. 获取 index，通过 `findDeclRef(index.refs, offset)` 匹配光标所在的 ref
2. **仅当光标位于 ref 上时才补全**（`!ref → return null`）
3. 根据 ref 类型从 `index.decls` 过滤生成补全：

| ref 类型 | 补全内容 | 额外过滤 |
|---|---|---|
| `interface.controller` | 所有 controller 名 | — |
| `interface.resource` | 所有 resource 名 | — |
| `interface.task` | 所有 task 名 | — |
| `interface.group` | 所有 group 名 | — |
| `interface.option` | 所有 option 名 | — |
| `interface.case` | 同 option 下的 case 名 | `decl.option === ref.option` |
| `interface.input`（无 offset） | 同 option 下的 input 名 | `decl.option === ref.option` |

**补全项属性**：
- `kind`: `Reference`
- `insertText`: `JSON.stringify(name)` 去首尾引号（处理转义字符）
- `range`: ref.location 左右各扩展 1 字符（覆盖引号）
- 文档懒加载：`fillDetail` 在 `resolveCompletionItem` 中执行

**`interface.input` 特殊处理**：仅在 `ref.offset === undefined` 时补全——即光标在 key 位置（`"input_name":`），而非 value 位置。

---

### Hover（[hover.ts](../../../pkgs/extension/src/service/language/interface/hover.ts)）

**状态: 骨架代码**。方法体有注释掉的实现框架，当前始终返回 `null`。

---

### Definition（[definition.ts](../../../pkgs/extension/src/service/language/interface/definition.ts)）

**策略**：
1. 定位光标所在的 decl 或 ref
2. **光标在 decl 上** → `makeDecls() + makeRefs()` 并集（同名声明 + 所有引用）
3. **光标在 ref 上** → 仅 `makeDecls()`（跳转到目标声明）
4. 通过 `autoConvertRangeLocation` 转换为跨文件 Location

---

### Reference（[reference.ts](../../../pkgs/extension/src/service/language/interface/reference.ts)）

**策略**：与 Definition 对称，始终返回 `makeDecls() + makeRefs()` 的**并集**。

---

### CodeLens（[codeLens.ts](../../../pkgs/extension/src/service/language/interface/codeLens.ts)）

**刷新**：debounce(50ms)，监听 `onInterfaceChanged` 和 `onInterfaceConfigChanged`。

**策略**：遍历当前文件中所有 decl，为两种类型生成 CodeLens：

**`interface.resource`** — 三态按钮：
| 状态 | 判定条件 | 显示 |
|---|---|---|
| 已激活 | `decl.name === config.resource` | 纯文本 "已激活" |
| 已禁用 | `decl.controller` 不包含当前激活 controller | 纯文本 "已禁用" |
| 可切换 | 其余情况 | "切换" 按钮 → `commands.PISwitchResource` |

**`interface.language`** — 两态按钮：
| 状态 | 判定条件 | 显示 |
|---|---|---|
| 已激活 | `decl.name === config.__locale` | 纯文本 "已激活" |
| 可切换 | 其余情况 | "切换" 按钮 → `commands.PISwitchLocale` |

---

### DocumentLink（[documentLink.ts](../../../pkgs/extension/src/service/language/interface/documentLink.ts)）

**策略**：遍历当前文件中所有 ref，对路径类 ref 创建可点击链接：

| ref 类型 | 链接目标 |
|---|---|
| `interface.language_path` | 语言文件路径 |
| `interface.resource_path` | 资源目录路径 |
| `interface.import_path` | 导入文件路径 |

目标 = `joinPath(interfaceBundle.root, ref.target)`。

---

## 参见

- [LSP 策略总览](README.md)
- [Pipeline Language Provider 策略](pipeline.md)
