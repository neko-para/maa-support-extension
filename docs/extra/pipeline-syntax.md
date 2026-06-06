# Pipeline 语法双轨制

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 概述

MaaFramework 和 MaaAssistantArknights 使用两套不同的 pipeline 语法，`@nekosu/maa-pipeline-manager` 同时支持两者。

## MaaFramework v1 语法（Framework 模式）

### 特征

- 任务属性平铺在一个 JSON 对象中
- 识别和动作属性混合（如 `template`、`text`、`action_type`）
- 任务引用格式: `"TaskName"` 或 `"TaskName[Anchor]"`

### 示例

```jsonc
{
  "Start": {
    "template": "start_button.png",
    "action": "ClickSelf",
    "next": ["MainTask", "BackupTask[JumpBack]"]
  }
}
```

## MaaAssistantArknights v2 语法（MAA 模式）

### 特征

- `recognition` 和 `action` 作为嵌套对象，包含 `type` + `param`
- `baseTask` 继承机制
- 表达式语法: `TaskA@TaskB#next`
- 特殊 task reference 后缀 `@TaskN` 表示继承链
- 属性名多使用 snake_case

### 示例

```jsonc
{
  "Start": {
    "baseTask": "BaseStart",
    "algorithm": "MatchTemplate",
    "template": "start_button.png",
    "action": "ClickSelf",
    "next": ["TaskA@TaskB#next", "(TaskC+TaskD)@BaseTask#sub"]
  }
}
```

## 属性键名差异

| Framework v1 | MAA v2 |
|---|---|
| `algorithm` | `algorithm` 或 `recognition.type` |
| `action_type` | `action` 或 `action.type` |
| `next` | `next` (string 数组) |
| `template` | `recognition.param.template` |
| (无) | `baseTask`、`exceededNext`、`onErrorNext`、`reduceOtherTimes` |

## 表达式语法（MAA 独有）

| 操作符 | 含义 | 示例 |
|---|---|---|
| `@` | 链式继承 | `TaskA@TaskB` |
| `#` | 虚拟属性 | `TaskA#next` |
| `*` | 重复 | `TaskA*3` |
| `+` | 联合 | `TaskA+TaskB` |
| `^` | 差集 | `TaskA^TaskB` |
| `()` | 分组 | `(TaskA+TaskB)@Base` |

## 代码中的实现

### 属性分割: `splitNode()`

[maa-pipeline-manager/src/parser/task/split.ts](../../pkgs/maa-pipeline-manager/src/parser/task/split.ts) 根据 `maa: boolean` 标志使用不同的键名列表：

- Framework: `nodeKeys`、`recoKeys`、`actKeys`
- MAA: `maaNodeKeys`、`maaRecoKeys`、`maaActKeys`

### MAA 表达式: `parseMaaExpr()`

[maa-pipeline-manager/src/parser/task/maa/expr.ts](../../pkgs/maa-pipeline-manager/src/parser/task/maa/expr.ts) 调用 `@nekosu/maa-tasker` 的 `parseExpr()`。

### MAA 模式检测

`@mse/extension` 通过检测工作区中是否存在 `src/MaaCore` 目录来判断 MAA 模式。
