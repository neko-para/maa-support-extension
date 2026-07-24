# Pipeline 语法

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 概述

本项目涉及**两套独立**的 pipeline 语法系统，结构和风格相似但彼此无关：

| 系统                      | 说明                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **MaaFramework**          | 通用自动化框架的 pipeline 语法。V1（平铺属性）和 V2（`recognition`/`action` 嵌套对象）均为官方支持的语法，可同时存在于同一 pipeline 中。 |
| **MaaAssistantArknights** | 明日方舟专有项目的 pipeline 语法。引入 `baseTask` 继承机制和 `@` 表达式语法。与 MaaFramework 语法无依赖关系。                            |

## MaaFramework 语法

### V1（平铺格式）

任务属性平铺在一个 JSON 对象中，识别和动作相关属性直接写在顶层：

```jsonc
{
  "Start": {
    "template": "start_button.png",
    "action": "ClickSelf",
    "next": ["MainTask", "BackupTask[JumpBack]"]
  }
}
```

### V2（嵌套格式）

识别和动作分别封装为 `recognition` 和 `action` 对象，内部使用 `type` + `param` 结构：

```jsonc
{
  "Start": {
    "recognition": {
      "type": "TemplateMatch",
      "param": { "template": "start_button.png" }
    },
    "action": {
      "type": "ClickSelf"
    },
    "next": ["MainTask"]
  }
}
```

### V1 与 V2 的关系

- 均为 MaaFramework 官方支持的语法，**无依赖关系**
- 同一 pipeline 文件中 V1 和 V2 格式可**同时存在**（不同任务可使用不同格式）
- `maa-pipeline-manager` 通过 `splitNode()` 自动识别两种格式

## MaaAssistantArknights 语法

MaaAssistantArknights 是独立项目，拥有自己的 pipeline 语法，引入 `baseTask` 继承机制和 `@` 表达式：

### `baseTask` 继承

```jsonc
{
  "MyTask": {
    "baseTask": "BaseStart",
    "template": "custom_button.png"
    // 其他属性从 BaseStart 继承
  }
}
```

### `@` 表达式

在任务引用中使用 DSL 表达式：

```jsonc
{
  "next": ["TaskA@TaskB#next", "(TaskC+TaskD)@BaseTask#sub"]
}
```

| 操作符 | 含义     | 示例                 |
| ------ | -------- | -------------------- |
| `@`    | 链式继承 | `TaskA@TaskB`        |
| `#`    | 虚拟属性 | `TaskA#next`         |
| `*`    | 重复     | `TaskA*3`            |
| `+`    | 联合     | `TaskA+TaskB`        |
| `^`    | 差集     | `TaskA^TaskB`        |
| `()`   | 分组     | `(TaskA+TaskB)@Base` |

## 三者的关系

三套语法彼此独立。MaaFramework V1 和 V2 可在同一 pipeline 中共存；MaaAssistantArknights 是独立项目，结构与 MaaFramework 相似但无依赖关系。

```
MaaFramework V1          MaaFramework V2          MaaAssistantArknights
(平铺属性)               (recognition/action)     (baseTask + @ 表达式)
     │                         │                         │
     └── 可共存 ────────────────┘                         │
           │                                              │
           │           独立系统，结构相似                    │
           └──────────────────────────────────────────────┘
```

## 代码中的实现

### 属性分割: `splitNode()`

[maa-pipeline-manager/src/parser/task/split.ts](../../pkgs/maa-pipeline-manager/src/parser/task/split.ts) 使用两套键名列表识别不同格式：

- Framework V1 平铺: `nodeKeys`、`recoKeys`、`actKeys`
- Framework V2 嵌套: `recognition` / `action` 对象（通过结构检测）
- MAA 独立语法: `maaNodeKeys`、`maaRecoKeys`、`maaActKeys`（新增 `baseTask` 等）

### MAA 表达式: `parseMaaExpr()`

[maa-pipeline-manager/src/parser/task/maa/expr.ts](../../pkgs/maa-pipeline-manager/src/parser/task/maa/expr.ts) 调用 `@nekosu/maa-tasker` 的 `parseExpr()`。

### MAA 模式检测

`@mse/extension` 通过检测工作区中是否存在 `src/MaaCore` 目录来判断 MAA 模式。
