# Extension — 技术架构

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用技术约定](../extra/common-tech.md)。

## 模块架构

```
src/
├── extension.ts              # 插件入口 (activate/deactivate)
├── utils/                    # 扩展级工具
│   ├── config.ts             # maatools.config.mts 加载 (jiti)
│   ├── fs.ts                 # 工作区文件系统辅助
│   ├── settings.ts           # VSCode 设置读取
│   └── eval.ts               # MAA 表达式求值错误代理
├── tools/                    # 服务端处理工具
│   └── jimp.ts               # 精简 Jimp (PNG + crop)
└── service/                  # 服务层
    ├── index.ts              # 服务创建和初始化编排
    ├── context.ts            # DisposableHelper / BaseService 基类
    ├── state.ts              # StateService — 工作区状态持久化
    ├── shortcut.ts           # ShortcutService — 全局快捷键目标租约和跨窗口请求转发
    ├── native.ts             # NativeService — MaaFramework 二进制管理
    ├── server.ts             # ServerService — RPC 连接管理
    ├── root.ts               # RootService — 资源根目录扫描
    ├── interface.ts          # InterfaceService — 接口包管理
    ├── launch.ts             # LaunchService — 任务启动编排
    ├── command.ts            # CommandService — VSCode 命令注册
    ├── debug.ts              # DebugService — 调试适配器
    ├── diagnostic.ts         # DiagnosticService — pipeline 诊断
    ├── statusBar.ts          # StatusBarService — 状态栏
    ├── agent.ts              # AgentService — agent 子进程管理
    ├── webview/
    │   ├── control.ts        # WebviewControlService — 控制面板
    │   ├── launch.ts         # WebviewLaunchPanel — 启动面板
    │   └── crop.ts           # WebviewCropPanel — 裁剪面板
    ├── language/
    │   ├── interface/        # interface.json 语言特性提供者
    │   │   ├── base.ts
    │   │   ├── codeLens.ts
    │   │   ├── completion.ts
    │   │   ├── definition.ts
    │   │   ├── documentLink.ts
    │   │   ├── hover.ts
    │   │   └── reference.ts
    │   └── pipeline/         # pipeline 文件语言特性提供者
    │       ├── base.ts
    │       ├── codeAction.ts
    │       ├── codeLens.ts
    │       ├── color.ts
    │       ├── completion.ts
    │       ├── definition.ts
    │       ├── documentLink.ts
    │       ├── hover.ts
    │       ├── inlayHint.ts
    │       ├── reference.ts
    │       └── symbol.ts
    └── utils/                # 服务级工具
        ├── rpc.ts            # TCP JSON-RPC 通信 (vscode-jsonrpc)
        ├── process.ts        # 子进程启动 + UAC 提权
        ├── content.ts        # VSCode 内容加载器/监视器适配器
        ├── png.ts            # PNG data URL 辅助
        ├── debounce.ts       # debounce 工具
        ├── flush.ts          # FlushHelper 抽象类
        ├── promise.ts        # makePromise() 延迟 Promise
        └── color.js/.d.ts    # HSV→RGB 转换
```

## 服务类层次

```
DisposableHelper
  └── BaseService
       ├── StateService
       ├── ShortcutService
       ├── NativeService
       ├── ServerService
       ├── RootService
       ├── InterfaceService
       ├── LaunchService
       ├── CommandService
       ├── DebugService
       ├── DiagnosticService
       ├── StatusBarService
       ├── AgentService
       ├── WebviewControlService
       ├── InterfaceLanguageProvider → Interface*Providers
       └── PipelineLanguageProvider → Pipeline*Providers
```

## 跨窗口全局快捷键

`ShortcutService` 在扩展的 `globalStorageUri/shortcut-control` 下维护跨窗口协调文件：

- 每个窗口用 session 文件发送心跳；`target.json` 记录唯一目标，后激活窗口会取得租约，超时或关闭后租约失效
- 非目标窗口通过临时文件原子改名投递请求；文件监听负责唤醒，轮询负责兜底，目标窗口删除请求后执行

该机制只转移快捷键命令的执行目标，不终止其他窗口中已经运行的 Maa 实例。

## 依赖关系

### 工作区依赖

| 包 | 角色 |
|---|---|
| `@mse/maa-server-proto` | JSON-RPC 协议类型 |
| `@mse/types` | 前后端共享类型 |
| `@mse/utils` | 通用工具 (WebviewProvider, logger) |
| `@nekosu/maa-locale` | 国际化 |
| `@nekosu/maa-pipeline-manager` | 核心解析引擎 |
| `@nekosu/maa-tasker` | MAA 任务类型和表达式 |
| `@nekosu/maa-tools` | `FullConfig` 类型 |
| `@nekosu/maa-version-manager` | MaaFramework 版本管理 |
| `@nekosu/simple-parser` | 简单解析器 |

### 外部依赖

| 包 | 用途 |
|---|---|
| `@maaxyz/maa-node` | MaaFramework 原生绑定 |
| `@vscode/debugadapter` | 调试适配器协议实现 |
| `@vscode/debugprotocol` | 调试适配器协议类型 |
| `vscode-jsonrpc` | JSON-RPC 通信 |
| `jsonc-parser` | JSONC 解析 |
| `semver` | 版本比较 |
| `jiti` | 运行时 TypeScript 配置加载 |
| `uuid` | UUID 生成 |
| `source-map-support` | 源码映射 |
| `@jimp/core`、`@jimp/js-png`、`@jimp/plugin-crop` | 图片裁剪 |

## 技术选型

| 选择 | 理由 |
|---|---|
| `vscode-jsonrpc` over TCP | 子进程需要独立运行（可能提权），TCP 不受 stdio 限制 |
| `jiti` 配置加载 | 允许用户编写 TypeScript 配置，运行时直接加载 |
| Proxy 模式 IPC | 类型安全的双向 RPC，无需手动序列化 |
| 自定义 Debug Adapter | 复用 VSCode 调试 UI 控制任务执行 |
| Jimp 精简版 | 仅包含 PNG + crop 插件，最小化依赖 |
| 两套 Language Provider | 反映两层结构：interface 文件和 pipeline 文件 |

## 日志与存储目录

插件使用 context.storageUri（回退到 context.globalStorageUri）作为存储根目录（下记 storage）：

- **插件自身日志**: storage/mse.log
- **MAA 日志**: storage/debug/（maafw.log / maa.log）。extension 向 maa-server 传递精确的 `maaLog = <storage>/debug` 路径，maa-server 直接设置 `maa.Global.log_dir = option.maaLog`，日志写入该 `debug` 子目录而非 storage 根目录。这样避免 MaaFramework 以 storage 根目录为日志目录时递归清理其下的 `fixed/*.png`。OpenMaaLog 命令按 maafw.log → maa.log 顺序在 storage/debug/ 下查找。
- **Native 模块**: context.globalStorageUri/native

## 构建

- **配置**: [tsdown.config.mts](../../../pkgs/extension/tsdown.config.mts)
- **输出**: `release/out/extension.mjs`
- **Server 进程**: 单独构建 → `release/server/index.mjs`
- **Webview 前端**: Vite 构建 → `release/webview/`
- **开发模式**: Vite HMR 通过 `forward.html` iframe 代理
