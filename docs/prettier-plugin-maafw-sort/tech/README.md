# Prettier Plugin Maafw Sort — 技术架构

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用技术约定](../extra/common-tech.md)。零工作区依赖。

## 模块架构

```
src/
├── index.ts          # 插件入口: parsers, options, patchPlugin()
├── option.ts         # Prettier 选项定义和 parseOption()
└── parser.ts         # 核心排序逻辑
                      #   - createParser(): 包装 Prettier babel JSON 解析器
                      #   - sortObject(): 属性重排
                      #   - processPipelineTask/processPipelineRoot: pipeline 任务与根处理
                      #   - processInterfaceRoot/looksLikeInterface: interface 结构遍历与内容探测
```

## 排序算法

### Pipeline 模式 (processPipelineRoot)

```
1. 遍历根对象，跳过 $ 前缀 root field
2. 每个任务对象按标准 key 顺序排列:
   desc/doc → enabled → max_hit → sub_name → recognition(及其参数) → inverse
   → pre_wait_freezes/pre_delay → action(及其参数，含 contact/pressure/auto_up)
   → anchor → repeat/repeat_wait_freezes/repeat_delay → post_wait_freezes/post_delay
   → timeout/rate_limit → next/on_error → focus/attach → ...
   all_of/any_of 的条目（内联识别定义）按同一任务级 orders 排序，
   sub_name 即挂在此处（条目内 sub_name → recognition → 参数）
   wait_freezes（对象或数组）与 focus 对象内部同样按标准顺序排序
3. 对 recognition/action 子对象: type → param
4. 对不识别的 key 保持原位（相对于它们首次出现的位置）
5. 递归处理嵌套对象
```

### Interface 模式 (processInterfaceRoot)

```
1. 根级 section 结构化遍历:
   - controller/resource/task/preset/group/pretask/setting 数组 → 每个条目按标准 key 顺序排序
   - option Record → 每个 option 及其 cases/inputs 条目排序
   - agent/pretask 支持单对象或数组
2. 各条目的 pipeline_override 走 Pipeline 模式；未知 section 或形状异常的
   已知 section 递归查找 pipeline_override 兜底
3. 最后对根对象应用根级 key 顺序（遵循协议文档字段介绍顺序:
   interface_version → languages → 元信息 → controller/resource
   → pretask/agent → group/task/option/global_option/setting → import/preset）；
   $ 前缀 root field（如 $schema）不参与排序，按原始下标插回原位
4. 所有数组顺序保留（协议语义：UI 展示顺序、import 合并优先级、资源覆盖顺序）
```

### 内容探测 (looksLikeInterface)

pattern 均未命中时按强信号判定，用于覆盖被 interface `import` 的任意命名片段文件：

- `task`/`controller`/`resource`/`preset` 数组中存在含字符串 `name` 及对应标志 key
  （`entry`/`type`/`path`/`task`，且值形态匹配）的条目，或
- `option` Record 存在含 `cases`/`inputs`/`hotkeys`/`default_case`/`pipeline_override` 的条目。

强信号避免误伤无关 JSON（如 `"task": ["build", "test"]` 不触发）；pipeline 文件的
根任务值恒为对象，不会命中。仅含 `group`/`global_option`/`setting` 的片段不单独触发。

### Locale 模式 (processLocaleValue)

```
1. 匹配 maafwLocalePatterns（默认 /locales/.*\.jsonc?）的文件（只看路径，不跟踪 languages 引用）
2. 递归按 UTF-16 码元字典序排序所有对象 key（locale 是纯数据 map，key 无语义；
   UTF-16 码元序与 ICU/locale 无关，跨环境确定）
3. 数组顺序保留
```

### 插件共存 (patchPlugin)

```
1. 遍历目标插件的 parsers
2. 对 json/jsonc 解析器应用排序包装
3. 对非 json/jsonc 解析器直接保留
```

## 依赖关系

### 外部依赖

| 包             | 用途                         |
| -------------- | ---------------------------- |
| `@babel/types` | AST 节点构造和验证           |
| `prettier`     | peer 依赖，Prettier 插件 API |

## 技术选型

| 选择                       | 理由                                                      |
| -------------------------- | --------------------------------------------------------- |
| Babel AST (`@babel/types`) | Prettier 内部使用 Babel 解析 JSON，复用 AST 避免额外解析  |
| 后处理模式                 | 在 Prettier 格式化前插入，确保排序后仍由 Prettier 格式化  |
| `patchPlugin()`            | 解决多插件冲突，允许与其他 JSON Prettier 插件共存         |
| 正则文件过滤器             | 精确控制插件作用域，避免影响非 MAA 的 JSON 文件           |
| 内容探测兜底               | 被 import 的 interface 片段文件命名任意，pattern 无法覆盖 |
