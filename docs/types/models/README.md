# Types — 产品定义

## 包标识

- **npm 包名**: `@mse/types`
- **类型**: 共享类型和协议定义

## 目标用户

- `@mse/extension` — 插件 host 端
- `@mse/webview` — 插件 webview 端
- `@mse/maa-server` — server 端
- `@mse/maa-server-proto` — 协议定义端
- `@mse/utils` — 工具端

## 核心能力

### 1. Webview IPC 协议类型

定义三个 webview panel 的双向通信协议：

| Panel | 类型文件 |
|---|---|
| Control | `src/webview/control.ts` |
| Crop | `src/webview/crop.ts` |
| Launch | `src/webview/launch.ts` |

每个协议定义：
- `{Panel}HostState` — Host 推送的状态数据
- `{Panel}HostToWeb` — Host → Webview 消息
- `{Panel}WebToHost` — Webview → Host 消息

### 2. 通用协议基类型

`src/webview/base.ts` 定义：

- `HostToWeb<Impl>` / `WebToHost<Impl>` — 内置命令 + 自定义命令的泛型组合
- `HostStateBase` — 通用状态字段（`isMAA`、`fwStatus`、`locale`、`tooltipDisabled`）
- `ImplType` — 命令基础类型
- `seq` 字段支持 request-response 模式

### 3. 日志类型

`LogCategory` — winston 日志级别联合类型。

## 抽象边界

- **纯类型库**，零运行时代码（`LogCategory` 类型除外）
- 不进行构建（`"main": "./src/index.ts"`，由消费方打包器直接处理）
- 使用 `@maaxyz/maa-node` 和 `@nekosu/maa-pipeline-manager` 类型但不转发
