# Maa Pipeline Manager — 技术架构

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用技术约定](../extra/common-tech.md)。

## 运行时入口

| 入口                                   | 环境    | 能力                                                          |
| -------------------------------------- | ------- | ------------------------------------------------------------- |
| `@nekosu/maa-pipeline-manager`         | Node.js | 文件加载/监视、路径编排、parser、layer、diagnostic 与 runtime |
| `@nekosu/maa-pipeline-manager/logic`   | Browser | interface 类型、runtime/option 构建；无文件系统和 Node API    |
| `@nekosu/maa-tools/pm`（间接重新导出） | Node.js | 主入口的完整 API                                              |

主入口中的 `Bundle` / `InterfaceBundle` 建模的是真实目录树，直接依赖 `node:path`、`node:events`、Node 事件循环以及 chokidar。`IContentLoader` / `IContentWatcher` 的边界只负责替换 Node host 内的内容读取和事件来源，供 VS Code 文档覆盖、测试实现等场景使用；它们并不承诺把完整文件编排层移植到浏览器。

`./logic` 是独立构建入口，Webview 只从该入口导入。包级测试使用 esbuild 的 `platform: 'browser'` 打包其源码且不提供 Node polyfill；任何越界依赖都会直接导致测试失败。

## 模块架构

```
src/
├── index.ts                  # 公共 API 入口
├── utils/                    # 基础工具
│   ├── types.ts              # 品牌化类型和路径辅助
│   ├── json.ts               # JSON/JSONC 树操作
│   └── helper.ts             # 引用过滤/查找辅助
├── parser/                   # 解析引擎
│   ├── utils.ts              # 共享解析工具 (生成器、类型守卫)
│   ├── task/                 # Pipeline 任务解析
│   │   ├── task.ts           # 入口: parseTask()
│   │   ├── split.ts          # 属性分类 (base/reco/act)
│   │   ├── keys.ts           # 属性键名规范列表
│   │   ├── next.ts           # next 引用解析
│   │   ├── anchor.ts         # 锚点声明解析
│   │   ├── roi.ts            # ROI 引用解析
│   │   ├── target.ts         # target/begin/end 解析
│   │   ├── template.ts       # 模板图片引用解析
│   │   ├── swipe.ts          # swipe 引用解析
│   │   ├── subName.ts        # sub 识别名解析
│   │   ├── focus.ts          # locale 引用解析
│   │   ├── freeze.ts         # freeze 引用解析
│   │   ├── color.ts          # 颜色定义解析
│   │   ├── colorFilter.ts    # color_filter 引用解析
│   │   ├── attr.ts           # [属性] 注解解析
│   │   └── maa/
│   │       ├── baseTask.ts   # MAA baseTask 引用解析
│   │       └── expr.ts       # MAA 表达式解析
│   └── interface/            # Interface 文件解析
│       ├── interface.ts      # 入口: parseInterface()
│       ├── types.ts          # 声明/引用类型定义
│       ├── language.ts       # 语言映射解析
│       ├── ctrlRef.ts        # controller 引用解析
│       ├── group.ts          # group 声明解析
│       ├── import.ts         # import 引用解析
│       ├── input.ts          # input 字段解析
│       ├── option.ts         # option 定义解析
│       ├── optionRef.ts      # option 引用解析
│       ├── override.ts       # pipeline_override 解析
│       ├── path.ts           # 资源路径解析
│       ├── preset.ts         # preset 解析
│       ├── case.ts           # case 声明解析
│       └── resRef.ts         # resource 引用解析
├── layer/                    # 分层任务存储
│   └── layer.ts              # LayerInfo: 任务映射、跨层合并、配置求值
├── content/                  # 文件系统抽象
│   ├── loader.ts             # IContentLoader + FsContentLoader
│   ├── watch.ts              # IContentWatcher + FsContentWatcher
│   └── json.ts               # ContentJson<T>: 显式 load/stop 的 JSON/JSONC 文件监视
├── bundle/                   # Pipeline 包管理
│   ├── manager.ts            # BundleManager: 文件事件合并和分发
│   └── bundle.ts             # Bundle: pipeline 资源目录管理
├── interface/                # 顶级接口编排
│   ├── interface.ts          # InterfaceBundle: 中央调度器
│   └── language.ts           # LanguageBundle: 语言文件管理
├── logic/                    # 运行时配置构建
│   ├── types/
│   │   ├── interface.ts      # domain 类型定义
│   │   ├── interfaceConfig.ts # 用户配置类型
│   │   └── interfaceRuntime.ts # 运行时类型
│   ├── runtime/
│   │   ├── controller.ts     # buildControllerRuntime()
│   │   ├── resource.ts       # buildResourceRuntime()
│   │   ├── option.ts         # buildOption() — 选项依赖链解析
│   │   └── task.ts           # buildTaskRuntime() — 任务运行时组装
│   └── index.ts              # ./logic 子路径入口
└── diagnostic/               # 诊断引擎
    ├── types.ts              # ~25 种诊断类型
    ├── diagnostic.ts         # performDiagnostic() 调度
    ├── task.ts               # checkTask() — pipeline 验证
    ├── interface.ts          # checkInterface() — interface 验证
    └── message.ts            # buildDiagnosticMessage() — 消息格式化
```

## 核心数据流

```
文件系统 ──→ FsContentWatcher
                │
                ▼
          BundleManager (debounce 批量)
                │
                ▼
             Bundle (单个资源目录)
                │
                ▼
           parseTask() → LayerInfo (分层存储)
                │
                ▼
          InterfaceBundle (顶层编排)
                │              │
                ▼              ▼
       performDiagnostic()   buildTaskRuntime()
```

`ContentJson` 构造函数只初始化状态，由所属 bundle 显式调用 `load()`，避免构造时的异步加载与调用方加载发生竞争并创建重复 watcher。`InterfaceBundle.stop()` 负责关闭 interface、import、locale 和 resource 的全部 watcher。

CLI checker 虽然是一次性消费者，仍复用 `FsContentWatcher` 的首次扫描和 `ready` 边界加载文件，并在该检查任务结束时立即 `stop()`。曾尝试使用专用的一次性 `fs.readdir()` snapshot 实现；M9A 和 MaaEnd 的输出与现有实现逐字一致，但最佳实验中位数仍分别从 4.874 秒增至 5.130 秒、从 6.298 秒增至 6.816 秒。因此保留 chokidar 的成熟递归扫描，不另行维护 snapshot 分支。

`InterfaceBundle.resolvePaths(controller, resource)` 是无状态路径解析入口；`switchActive()` 和 `updatePaths()` 复用该结果更新活动 bundle。批处理消费者可先计算所有组合的路径，在独立 bundle 中并发处理，而无需并发修改同一个 `InterfaceBundle` 的 active 状态。

## 依赖关系

### 工作区依赖

| 包                   | 角色                     |
| -------------------- | ------------------------ |
| `@nekosu/maa-locale` | 诊断消息国际化           |
| `@nekosu/maa-tasker` | MAA 表达式解析、任务类型 |

### 外部依赖

| 包             | 用途                           |
| -------------- | ------------------------------ |
| `chokidar`     | 文件系统监视                   |
| `jsonc-parser` | JSONC AST 解析（保留源码位置） |

### Dev 依赖

| 包                 | 用途                                                 |
| ------------------ | ---------------------------------------------------- |
| `@maaxyz/maa-node` | MAA 原生类型引用（`maa.RecognitionType` 等）         |
| `esbuild`          | 验证 `./logic` 可在无 Node polyfill 的浏览器环境打包 |

## 技术选型

| 选择                             | 理由                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| `jsonc-parser` 而非 `JSON.parse` | 保留每个节点的源码偏移量和长度，支持精确诊断                                              |
| `chokidar` 而非 `fs.watch`       | 跨平台文件监视，更好的 debounce 和递归监视                                                |
| 品牌化类型而非枚举               | 零运行时开销的名义类型，编译期防止路径混淆                                                |
| EventEmitter 而非回调            | 支持 Node host 内的多消费者、异步事件链（但 checker 侧使用困难，详见 [specs](../specs/)） |
| 生成器函数                       | 惰性 AST 遍历，支持提前终止                                                               |
| MAA/Framework 双解析器           | 支持两种并存的 pipeline 语法                                                              |
