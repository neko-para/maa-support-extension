# 包依赖关系图

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 完整依赖图

```
                              ┌─────────────────┐
                              │  simple-parser   │ (零依赖，LL* 解析器)
                              └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │   maa-tasker     │ (MAA 表达式解析)
                              └────────┬────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
   ┌──────────▼──────────┐  ┌─────────▼─────────┐              │
   │  maa-version-manager│  │   maa-locale      │              │
   │  (版本下载管理)      │  │   (国际化文案)     │              │
   └──────────┬──────────┘  └─────────┬─────────┘              │
              │                        │                        │
              │              ┌─────────▼─────────┐              │
              │              │ maa-pipeline-mgr  │◄─────────────┘
              │              │ (核心解析引擎)     │
              │              └─────────┬─────────┘
              │                        │
              │      ┌─────────────────┼─────────────────┐
              │      │                 │                  │
   ┌──────────▼──────▼──┐    ┌────────▼────────┐  ┌──────▼──────────┐
   │    maa-tools       │    │    extension     │  │   webview       │
   │    (CLI 检查器)    │    │   (VSCode 插件)  │  │   (Vue 前端)    │
   └────────────────────┘    └────────┬────────┘  └──────▲──────────┘
                                      │                  │
                            ┌─────────┼─────────┐        │
                            │         │         │        │
                    ┌───────▼──┐ ┌───▼────┐ ┌──▼──────┐ │
                    │maa-server│ │ types  │ │  utils   │ │
                    │(代理进程) │ │(类型库)│ │(工具库)  │─┘
                    └─────┬────┘ └────────┘ └──────────┘
                          │
                  ┌───────▼────────┐
                  │maa-server-proto│
                  │(通信协议)       │
                  └────────────────┘

         ┌────────────────────────────┐
         │prettier-plugin-maafw-sort  │ (独立，零内部依赖)
         └────────────────────────────┘
```

## 依赖分层

### 第 0 层：零依赖基础

| 包                                   | 说明          |
| ------------------------------------ | ------------- |
| `@nekosu/simple-parser`              | LL\* 解析库   |
| `@nekosu/maa-locale`                 | 国际化文案    |
| `@nekosu/prettier-plugin-maafw-sort` | Prettier 插件 |

### 第 1 层：算法引擎

| 包                   | 依赖              |
| -------------------- | ----------------- |
| `@nekosu/maa-tasker` | ← `simple-parser` |

### 第 2 层：核心解析 + 基础设施

| 包                             | 依赖                                          |
| ------------------------------ | --------------------------------------------- |
| `@nekosu/maa-pipeline-manager` | ← `maa-tasker`, `maa-locale`                  |
| `@mse/types`                   | ← `maa-pipeline-manager`, `maa-node`          |
| `@mse/maa-server-proto`        | ← `types`, `maa-pipeline-manager`, `maa-node` |
| `@nekosu/maa-version-manager`  | (零内部依赖)                                  |

### 第 3 层：应用和工具

| 包                  | 依赖                                                          |
| ------------------- | ------------------------------------------------------------- |
| `@nekosu/maa-tools` | ← `maa-pipeline-manager`, `maa-locale`, `maa-version-manager` |
| `@mse/maa-server`   | ← `maa-server-proto`, `types`, `maa-pipeline-manager`         |
| `@mse/utils`        | ← `types`                                                     |

### 第 4 层：最终用户

| 包               | 依赖                              |
| ---------------- | --------------------------------- |
| `@mse/extension` | ← 几乎所有包                      |
| `@mse/webview`   | ← `types`, `maa-pipeline-manager` |

## 构建顺序

构建顺序（来自 [scripts/build.mjs](../../scripts/build.mjs)）严格遵循依赖分层：

```
1. simple-parser (第 0 层)
2. maa-tasker    (第 1 层)
3. maa-version-manager, maa-pipeline-manager, maa-locale (第 2 层，并行)
4. maa-server, maa-tools, extension (第 3-4 层，并行)
5. prettier-plugin-maafw-sort (独立，第 0 层)
6. webview (Vite 独立构建)
```
