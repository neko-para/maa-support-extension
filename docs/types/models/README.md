# Types — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 包标识

- **npm 包名**: `@nekosu/maa-types`
- **类型**: 共享类型和协议定义

## 目标用户

- `@mse/extension` — 插件 host 端
- `@mse/webview` — 插件 webview 端
- `@nekosu/maa-server` — server 端
- `@nekosu/maa-server-proto` — 协议定义端

## 核心能力

### 1. Webview IPC 协议类型

定义三个 webview panel 的双向通信协议：

| Panel   | 类型文件                 |
| ------- | ------------------------ |
| Control | `src/webview/control.ts` |
| Crop    | `src/webview/crop.ts`    |
| Launch  | `src/webview/launch.ts`  |

每个协议定义：

- `{Panel}HostState` — Host 推送的状态数据
- `{Panel}HostToWeb` — Host → Webview 消息
- `{Panel}WebToHost` — Webview → Host 消息

Control 协议通过 `ControlHostState.saveDraw` 同步识别绘图落盘状态、`ControlHostState.saveOnError` 同步失败现场截图落盘状态，并分别使用 `switch-save-draw`、`switch-save-on-error` Toolkit target 请求切换；`shortcutTarget` 标识当前窗口是否持有全局快捷键目标租约，`activate-shortcuts` 用于取得该租约。

Crop 协议的 `CropSettings` 仅同步用户可配置的裁剪交互和可视化参数（含自定义下载保存目录 `saveDir`，配合 `requestPickFolder` 命令选取）；Canvas 背景色不属于协议设置，由 Webview 直接跟随 VS Code 编辑器主题。

Crop 协议的一次性识别结果统一为 `CropToolResult = { detail, failure? }`：`detail` 是 `maa.RecoDetailWithoutDraws` 的 JSON，`failure.message` 是宿主已本地化的文案（Webview 不再需要维护 agent 相关文案）。`requestReco` 返回 `CropToolResult | null`（`null` 表示用户取消了节点选择）；`requestColorMatch` 携带 `ColorMatchOptions`（roi/method/lower/upper/count/connected，`lower`/`upper` 为多区间数组）。快速识别的 agent 会话由宿主在面板全部关闭或 interface/pipeline/资源变更时主动释放（不经过 webview 协议）。截图/上传返回 `CropImageResult`、保存返回 `CropSaveResult`（含相对资源 image 目录的 `relativePath`，用户取消时为 `null`）：失败原因由宿主本地化，Webview 用 `null` 表示用户取消、用 `failure` 表示失败；`requestReveal` 用于显式打开保存目录，避免保存后自动抢焦点。

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
- 通过 tsdown 构建为 ESM + dts，发布到 npm
- 使用 `@maaxyz/maa-node` 和 `@nekosu/maa-pipeline-manager` 类型但不转发
