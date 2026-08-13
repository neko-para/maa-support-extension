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
│   ├── logger.ts             # Winston 日志与 VS Code OutputChannel 适配
│   ├── settings.ts           # VSCode 设置读取
│   ├── eval.ts               # MAA 表达式求值错误代理
│   └── webview/              # Host 侧 WebviewProvider 与开发模式 iframe 代理
│       ├── view.ts           # 侧边栏 WebviewViewProvider
│       ├── panel.ts          # 独立 WebviewPanel
│       └── forward.html      # Vite HMR 消息桥
├── tools/                    # 服务端处理工具
│   └── jimp.ts               # 精简 Jimp (PNG + crop)
└── service/                  # 服务层
    ├── index.ts              # 服务创建和初始化编排
    ├── registry.ts           # 零运行时实现依赖的服务 live bindings
    ├── context.ts            # DisposableHelper / BaseService 基类
    ├── state.ts              # StateService — 工作区状态持久化
    ├── shortcut.ts           # ShortcutService — 全局快捷键目标租约和跨窗口请求转发
    ├── native.ts             # NativeService — MaaFramework 二进制管理
    ├── server.ts             # ServerService — RPC 连接管理
    ├── mpe.ts                # MPE iframe 面板、握手、版本稳定快照、损坏 sidecar 拒绝加载、sidecar 与 Pipeline 同一次保存
    ├── mpeProtocol.ts        # mpe-embed 协议校验、JSONC 写回、`.mpe.json` 合并/拆分、sidecar 缺失/损坏判定
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

## 服务组合与依赖

`service/index.ts` 是唯一 composition root，负责按以下阶段启动服务：

1. 初始化 VS Code extension context
2. 按构造依赖顺序创建核心服务，每个服务构造完成后立即通过 `registerServices()` 增量发布到 `service/registry.ts`
3. 构造依赖核心服务的 Language/Webview Provider
4. 按显式顺序执行各服务的异步 `init()`

服务实现只从 `registry.ts` 读取其他单例，不得反向导入 `index.ts`。每个核心服务在后续服务开始构造前完成发布，保证构造函数读取的前置依赖已经存在。registry 对实现类全部使用 `import type`，编译后没有指向服务实现的运行时依赖，因此不会形成 `index → implementation → index` 的 ESM 环。架构测试使用 TypeScript AST 检查这些约束。

当前服务均服从 VS Code extension 的单实例生命周期，且 Server/Agent 等领域存在双向协作；引入第三方 DI 容器不会消除这些领域关系。类型化 registry 加显式 composition root 已覆盖初始化顺序和运行时模块环问题，因此不增加 DI 框架。

## 跨窗口全局快捷键

`ShortcutService` 在扩展的 `globalStorageUri/shortcut-control` 下维护跨窗口协调文件：

- 每个窗口用 session 文件发送心跳；`target.json` 记录唯一目标，后激活窗口会取得租约，超时或关闭后租约失效
- 非目标窗口通过临时文件原子改名投递请求；文件监听负责唤醒，轮询负责兜底，目标窗口删除请求后执行

该机制只转移快捷键命令的执行目标，不终止其他窗口中已经运行的 Maa 实例。

## 固定项目路径约定

以下路径是插件与项目、工具链之间的固定约定，不提供额外配置项：

- 工作区根目录存在 `src/MaaCore` 时，可靠地识别为 MaaAssistantArknights 项目并启用 MAA 兼容模式
- 每个 interface 项目的 `config/maa_pi_config.json` 保存该项目的插件配置
- 工作区根目录的 `maatools.config.mts` 是 maa-tools 配置入口；插件同时监视该文件的变更

## maa-server 连接生命周期

插件采用按需重连，而非后台定时重试：

- RPC 连接断开后，`RpcManager` 清空当前连接并发出 `connectionLost`，`ServerService` 将状态栏更新为断开
- 后续启动任务、截图或其他需要服务端的操作会调用 `ServerService.ensureServer()`，重新启动 maa-server 并建立连接
- 断线意味着子进程内的 Maa 运行实例已经丢失，重新连接不会也无法恢复原任务，因此断线后不立即启动空闲子进程

## MaaFramework Registry 状态

`NativeService` 从 global state 读取镜像类型，并在构造 `MaaVersionManager` 时注入对应 registry。服务公开的 `registry` 访问器直接代理 manager，镜像选择命令不维护第二份运行时状态；manager 再为每次查询和安装捕获操作级快照。

## 扩展级工具

日志和 Host 侧 WebviewProvider 只由 extension 使用，直接位于 `src/utils/`，不再通过独立 workspace 包转发。`logger.ts` 统一配置 Console、VS Code OutputChannel 和文件 transport；`utils/webview/` 负责生产静态页面加载及开发模式 `forward.html` iframe 消息桥。

## 命令归属

VS Code 命令按是否跨领域编排划分归属：

- 单一领域拥有的命令由对应服务或 Provider 注册，例如 MaaFramework 版本选择属于 `NativeService`，控制面板入口属于 `StatusBarService`，locale 提取属于 `PipelineCodeActionsProvider`
- 需要协调多个服务、处理 Quick Pick、编辑器跳转、临时文档或消息提示的应用层命令由 `CommandService` 集中注册
- `CommandService` 只负责 VS Code 交互与流程编排；runtime 构建、任务启动、RPC、interface 状态等核心操作仍由对应服务实现

除非某组命令产生可独立复用的领域逻辑，否则不为缩短构造函数而拆分额外服务，避免扩大模块级服务之间的循环依赖。

## 依赖关系

### 工作区依赖

| 包                             | 角色                  |
| ------------------------------ | --------------------- |
| `@nekosu/maa-server-proto`     | JSON-RPC 协议类型     |
| `@nekosu/maa-types`            | 前后端共享类型        |
| `@nekosu/maa-locale`           | 国际化                |
| `@nekosu/maa-pipeline-manager` | 核心解析引擎          |
| `@nekosu/maa-tasker`           | MAA 任务类型和表达式  |
| `@nekosu/maa-tools`            | `FullConfig` 类型     |
| `@nekosu/maa-version-manager`  | MaaFramework 版本管理 |
| `@nekosu/simple-parser`        | 简单解析器            |

### 外部依赖

| 包                                                | 用途                       |
| ------------------------------------------------- | -------------------------- |
| `@maaxyz/maa-node`                                | MaaFramework 原生绑定      |
| `@vscode/debugadapter`                            | 调试适配器协议实现         |
| `@vscode/debugprotocol`                           | 调试适配器协议类型         |
| `vscode-jsonrpc`                                  | JSON-RPC 通信              |
| `jsonc-parser`                                    | JSONC 解析                 |
| `semver`                                          | 版本比较                   |
| `jiti`                                            | 运行时 TypeScript 配置加载 |
| `uuid`                                            | UUID 生成                  |
| `source-map-support`                              | 源码映射                   |
| `@jimp/core`、`@jimp/js-png`、`@jimp/plugin-crop` | 图片裁剪                   |
| `winston`、`winston-transport`、`triple-beam`     | 结构化日志与 VS Code 输出  |

## 技术选型

| 选择                      | 理由                                                |
| ------------------------- | --------------------------------------------------- |
| `vscode-jsonrpc` over TCP | 子进程需要独立运行（可能提权），TCP 不受 stdio 限制 |
| `jiti` 配置加载           | 允许用户编写 TypeScript 配置，运行时直接加载        |
| Proxy 模式 IPC            | 类型安全的双向 RPC，无需手动序列化                  |
| 自定义 Debug Adapter      | 复用 VSCode 调试 UI 控制任务执行                    |
| Jimp 精简版               | 仅包含 PNG + crop 插件，最小化依赖                  |
| 两套 Language Provider    | 反映两层结构：interface 文件和 pipeline 文件        |

## 日志与存储目录

插件将项目运行产物与内部存储分开管理：

- **插件自身日志**: `context.storageUri/mse.log`（无工作区时回退到 `context.globalStorageUri`）
- **MAA 日志和识别绘图**: 默认写入当前活动 interface 项目的 `debug/`。`maatools.config.mts` 可通过 `cwd` 和 `maaLogDir` 覆盖目录；相对 `cwd` 以工作区根目录为基准，相对 `maaLogDir` 以解析后的项目目录为基准。项目目录不可写或没有活动项目时回退到 `context.storageUri/debug/`。活动项目或配置使解析后的日志目录发生变化时会关闭 maa-server，使下次连接使用新目录。
- **上传图片副本**: `context.storageUri/fixed/`，与 MAA 日志目录分离，避免 MaaFramework 日志轮转递归清理 PNG。
- **Native 模块**: context.globalStorageUri/native

## 构建

- **配置**: [tsdown.config.mts](../../../pkgs/extension/tsdown.config.mts)
- **输出**: `release/out/extension.mjs`
- **Server 进程**: 单独构建 → `release/server/index.mjs`
- **Webview 前端**: Vite 构建 → `release/webview/`
- **开发模式**: Vite HMR 通过 `forward.html` iframe 代理
