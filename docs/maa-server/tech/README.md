# Maa Server — 技术架构

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用技术约定](../extra/common-tech.md)。`@maaxyz/maa-node` 不打包（运行时动态导入）。

## 模块架构

```
src/
├── index.ts          # 入口: 安装 source-map → initOptions() → initServer() → initMaa()
├── options.ts        # 启动配置: 解析 process.argv[2] (base64 JSON)
│                     #   { id, port, module, maaLog, debugMode, saveDraw }
├── server.ts         # TCP/RPC 传输层
│                     #   - 连接 127.0.0.1:{port}
│                     #   - 创建 vscode-jsonrpc MessageConnection
│                     #   - 注册所有 IPC 处理器
│                     #   - logger 转发日志到 Host
├── apis.ts           # Proxy 模式 IPC 桥
│                     #   - setupIpc(): 创建双向 RPC Proxy
│                     #   - ipc.$.method = handler → 本地注册
│                     #   - ipc.method(args) → 远程调用
├── maa.ts            # MaaFramework 核心包装 (~467 行)
│                     #   - 控制器管理 (ADB/Win32/PlayCover/Gamepad/Custom)
│                     #   - 资源/任务器/Agent 管理
│                     #   - 所有 IPC 处理器的实际实现
├── utils.ts          # makePromise(): 延迟 Promise 工厂
└── tools/            # 一次性识别工具
    ├── utils.ts      # convertImage(), setupFixedController()
    ├── ocr.ts        # OCR 工具 (throwaway MAA 实例)
    ├── reco.ts       # 识别测试工具
    └── templateMatch.ts # 模板匹配工具
```

## 启动流程

```
1. node server.mjs <base64-json>
2. index.ts → initOptions()     # 解析 base64 JSON → { id, port, module, maaLog, debugMode, saveDraw }
3. index.ts → initServer()      # 创建 TCP 连接到 127.0.0.1:{port}
                                 #   建立 vscode-jsonrpc MessageConnection
                                 #   发送 initNoti (包含 client id)
4. index.ts → initMaa()         # 动态 import(module) → 加载 MaaFramework
                                 #   设置 maa.Global.debug_mode
                                 #   设置 maa.Global.log_dir = option.maaLog
                                 #   （精确日志目录，由 Host 传入 <storage>/debug）
```

## MAA 日志目录

`initMaa()` 直接设置 `maa.Global.log_dir = option.maaLog`。Host（extension）传入精确的 `<storage>/debug` 路径作为 `maaLog`，而非 storage 根目录；MAA 原生日志（`maafw.log` 等）写入该 `debug` 子目录。这样避免 MaaFramework 以 storage 根目录为日志目录时递归清理其下的 `fixed/*.png`。

## 依赖关系

### 工作区依赖

| 包                             | 角色                                                 |
| ------------------------------ | ---------------------------------------------------- |
| `@mse/maa-server-proto`        | 协议类型和 RPC channel 定义                          |
| `@mse/types`                   | 共享类型                                             |
| `@nekosu/maa-pipeline-manager` | 运行时类型 (`ControllerRuntime`, `InterfaceRuntime`) |

### 外部依赖

| 包                   | 用途                                    |
| -------------------- | --------------------------------------- |
| `@maaxyz/maa-node`   | MaaFramework 原生绑定（运行时动态导入） |
| `vscode-jsonrpc`     | JSON-RPC 传输层                         |
| `source-map-support` | 源码映射                                |
| `uuid`               | 实例 ID 生成                            |
| `semver`             | 版本号比较                              |

## 技术选型

| 选择                     | 理由                                      |
| ------------------------ | ----------------------------------------- |
| TCP socket 而非 stdio    | 子进程可能需要 UAC 提权，stdio 管道会断开 |
| `vscode-jsonrpc`         | VSCode 生态标准，与插件端一致             |
| 动态 import MaaFramework | 服务器与 MAA 安装位置解耦                 |
| Proxy IPC                | 消除样板代码，类型安全的双向调用          |
| Throwaway instance       | 工具操作隔离，避免污染主实例              |

## 全局配置

`initMaa()` 将启动参数 `saveDraw` 直接写入 MaaFramework 的全局 `save_draw`。启用后识别绘制图像由 MaaFramework 保存到 `log_dir/vision`。
