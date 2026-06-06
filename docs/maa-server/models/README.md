# Maa Server — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 包标识

- **npm 包名**: `@mse/maa-server`
- **类型**: MaaFramework 代理进程

## 目标用户

- `@mse/extension` — VSCode 插件通过 JSON-RPC 连接此进程
- 不直接面向终端用户

## 存在的理由

VSCode 插件进程可能无法以管理员权限运行，而某些 MaaFramework 操作需要管理员权限。此包作为独立子进程运行以解决此问题。

## 核心能力

### 1. MaaFramework 加载

- 动态加载指定路径的 `@maaxyz/maa-node` 原生绑定
- 支持运行时切换 MaaFramework 版本（通过 `module` 选项指定路径）

### 2. 控制器管理

通过 MaaFramework API 管理多种控制器类型（ADB、Win32、PlayCover、Gamepad、自定义控制器等），提供统一的创建、更新接口。

### 3. 任务执行

- 创建和销毁 Tasker 实例
- 绑定 Controller、Resource 到 Tasker
- 注册 CustomAction 和 Agent
- 发布任务到 Tasker
- 停止任务执行

### 4. 图像工具

在独立 MaaFramework 实例中执行一次性识别操作：

- **OCR**: 对图像执行文字识别
- **模板匹配**: 使用自定义模板图像进行匹配
- **识别测试**: 加载资源包，运行指定任务的识别 pipeline

### 5. 设备发现

- `refreshAdb()` — 扫描 ADB 设备
- `refreshDesktop()` — 扫描桌面窗口

### 6. 截图

- 通过控制器获取当前屏幕截图

### 7. Agent 进程管理

- 通过回调 Host 启动 agent 子进程或调试会话
- 管理 agent 生命周期

## 连接协议

- **启动方式**: `node server.mjs <base64(json_options)>`
- **传输层**: TCP socket (`127.0.0.1:{port}`)
- **RPC 协议**: JSON-RPC (via `vscode-jsonrpc`)
- **协议定义**: [@mse/maa-server-proto](../maa-server-proto/models/)
