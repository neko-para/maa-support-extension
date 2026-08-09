# Maa Tools — 技术架构

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用技术约定](../extra/common-tech.md)。

## 模块架构

```
src/
├── index.ts              # API 入口
├── cli.ts                # CLI 调度器: runCli(cmd, cfg)
├── pm.ts                 # Pipeline Manager 转导出
├── check/
│   ├── index.ts          # runCheck(cfg): 诊断执行和输出
│   └── utils.ts          # calculateLocation() 偏移→行列转换
├── test/
│   ├── index.ts          # runTest(cfg): 测试调度和 workerpool 管理
│   ├── types.ts          # RecoJob, RecoResult, GroupRecoResult
│   ├── worker.ts         # Worker 进程入口 (MAA 识别执行)
│   ├── env.d.ts          # 环境变量类型声明
│   └── utils.ts          # checkRect() bounding box 验证
├── types/
│   └── config.ts         # 配置类型: BaseConfig, CheckConfig, TestConfig, FullConfig
└── utils/
    ├── bundle.ts         # InterfaceBundle 加载器
    ├── config.ts         # jiti 配置加载器
    ├── tools.ts          # 测试用例加载: loadTestCases(), loadAllTestCases()
    ├── maa.ts            # MAA 框架生命周期: setupMaa(), loadMaa(modulePath, logDir)
    │                     #   设置 maa.Global.log_dir = logDir（精确日志目录，
    │                     #   check 默认 <cwd>/debug，test 默认 <cwd>）
    └── utils.ts          # 通用工具: toArrayBuffer(), gzCompress(), makeFakeController()
```

## 核心流程

### check 流程

```
1. loadConfig(configPath) → FullConfig
2. setupMaa(cfg) → 下载/加载 MaaFramework
3. 创建发现用 InterfaceBundle，解析 controller×resource 组合的最终资源路径
4. 按有序路径列表合并等价组合
5. 按 `check.job`（默认 `min(4, availableParallelism)`）启动并发任务
6. 每个任务创建隔离的 InterfaceBundle 和 `maa.Resource`，共享只读文件内容缓存
7. 在任务内执行 `performDiagnostic()`，并按路径顺序执行 `post_bundle()`
8. 收集全部结果后按发现顺序格式化并输出诊断
```

并发调度在同一 Node.js 进程内完成，以兼容 `maatools.config.mts` 中不可序列化的自定义 parser 函数。每个任务拥有独立的可变 bundle 状态和 MaaFramework Resource；同一资源组内的多个路径仍顺序加载，保持资源覆盖语义。不同 controller/resource 组合若解析为完全相同的有序路径列表，只检查一次，输出标题会列出所有等价组合。

`CachedContentLoader` 在单次检查中缓存文件读取 Promise，使并发 bundle 共享同一份只读文件内容，避免公共资源文件被重复读取。`InterfaceBundle.stop()` 会完整关闭 interface、import、locale 与 resource watcher，确保 `runCheck()` 作为 API 调用时也能自然退出。

`runCheck()` 不是 watch 模式：它只使用 chokidar 的初始扫描生成待加载文件集，完成诊断后即关闭 watcher，项目变更后仍需重新调用 checker。一次性 snapshot 扫描已用 M9A 和 MaaEnd 验证：诊断输出完全一致，但两项目的中位耗时均增加，所以保留 chokidar 的初始扫描实现。

### test 流程

```
1. loadConfig(configPath) → FullConfig
2. setupMaa(cfg) → 下载/加载 MaaFramework
3. 加载所有测试用例
4. 解析每个 controller/resource 的有序资源路径，并合并路径完全相同的等价配置
5. 每组创建一个 workerpool，分发该组的 RecoJob 后立即释放
6. Worker: loadMaa() → setupInstance() → performReco()
7. 收集结果，按原 controller/resource 排序和 mode 输出
```

worker 进程从环境变量一次性加载资源，因此不同有序路径组不能共享同一个 pool。调度器先创建保持报告顺序的结果槽位，再按 `JSON.stringify(resourcePaths)` 的结构键聚合执行计划；相同路径即使来自不同 controller/resource 也只创建一次 pool，路径顺序不同则保持隔离。任一组结束或抛错时均在 `finally` 中终止 pool，同时发现用 `InterfaceBundle` 在规划完成后关闭全部 watcher。

## MAA 日志目录

`loadMaa(modulePath, logDir)` 直接设置 `maa.Global.log_dir = logDir`，保留 `cfg.maaLogDir` 配置字段及其兼容性，不重命名、不引入 `config_init_option`。

`setupMaa(cfg)` 在构造 `MaaVersionManager` 时同时注入 `maaCache` 和 `maaMirror`，使一次版本查询/安装从启动起使用确定的 registry。

- **check 流程**：未显式配置 `maaLogDir` 时默认 `debug`，即日志写入 `<cwd>/debug/`，避免以工作区根目录为日志目录时 MaaFramework 递归清理仓库内旧 PNG（TODO-23）。
- **test 流程**：保留原默认 `.`（cwd 根目录），通过 `MAAFW_LOG_DIR` 环境变量传入，worker 在其下按 pool/pid 建子目录隔离。

## 依赖关系

### 工作区依赖

| 包                             | 角色                  |
| ------------------------------ | --------------------- |
| `@nekosu/maa-locale`           | 输出国际化            |
| `@nekosu/maa-pipeline-manager` | Pipeline 加载/诊断    |
| `@nekosu/maa-version-manager`  | MaaFramework 版本管理 |

### 外部依赖

| 包              | 用途                    |
| --------------- | ----------------------- |
| `@actions/core` | GitHub Actions 注解输出 |
| `chalk`         | 终端颜色                |
| `jiti`          | 运行时 TS 配置加载      |
| `jsonc-parser`  | 测试用例 JSONC 解析     |
| `workerpool`    | 多进程并行测试          |

## 技术选型

| 选择                             | 理由                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `jiti` 配置加载                  | TypeScript 配置文件，IDE 类型检查                                                   |
| `workerpool`                     | 多进程并行，隔离 MAA 实例                                                           |
| check 进程内有限并发             | 保留自定义 parser 函数，并通过隔离 bundle/Resource 避免可变状态竞争                 |
| 三态输出模式                     | 统一 CLI/CI/API 消费                                                                |
| devDependency 作为 fallback 版本 | 从 devDeps 读取 `@maaxyz/maa-node`，使默认运行时版本与编译/类型检查版本保持单一来源 |
