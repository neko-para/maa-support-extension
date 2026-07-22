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
    ├── maa.ts            # MAA 框架生命周期: setupMaa(), loadMaa()
    └── utils.ts          # 通用工具: toArrayBuffer(), gzCompress(), makeFakeController()
```

## 核心流程

### check 流程

```
1. loadConfig(configPath) → FullConfig
2. setupMaa(cfg) → 下载/加载 MaaFramework
3. 创建 InterfaceBundle (FsContentLoader + FsContentWatcher)
4. 遍历 controller×resource 组合
5. performDiagnostic(bundle, options)
6. 按 mode 输出诊断
```

### test 流程

```
1. loadConfig(configPath) → FullConfig
2. setupMaa(cfg) → 下载/加载 MaaFramework
3. 加载所有测试用例
4. 创建 workerpool (按 controller+resource hash 分组)
5. 分发 RecoJob 到 worker 进程
6. Worker: loadMaa() → setupInstance() → performReco()
7. 收集结果, 按 mode 输出
```

## 依赖关系

### 工作区依赖

| 包 | 角色 |
|---|---|
| `@nekosu/maa-locale` | 输出国际化 |
| `@nekosu/maa-pipeline-manager` | Pipeline 加载/诊断 |
| `@nekosu/maa-version-manager` | MaaFramework 版本管理 |

### 外部依赖

| 包 | 用途 |
|---|---|
| `@actions/core` | GitHub Actions 注解输出 |
| `chalk` | 终端颜色 |
| `jiti` | 运行时 TS 配置加载 |
| `jsonc-parser` | 测试用例 JSONC 解析 |
| `workerpool` | 多进程并行测试 |

## 技术选型

| 选择 | 理由 |
|---|---|
| `jiti` 配置加载 | TypeScript 配置文件，IDE 类型检查 |
| `workerpool` | 多进程并行，隔离 MAA 实例 |
| 三态输出模式 | 统一 CLI/CI/API 消费 |
| devDependency 作为 fallback 版本 | 从 devDeps 读取 `@maaxyz/maa-node`，使默认运行时版本与编译/类型检查版本保持单一来源 |
