# Maa Tools — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 包标识

- **npm 包名**: `@nekosu/maa-tools`
- **类型**: CLI 检查器和测试工具
- **版本**: 1.0.25

## 目标用户

MAA pipeline 开发者和 CI/CD 流水线。

## 核心能力

### 1. Pipeline 检查 (`check`)

验证 pipeline 文件的完整性：

```bash
npx @nekosu/maa-tools check [config-path]
```

- 加载 interface bundle
- 遍历所有 controller/resource 组合，并合并最终资源路径顺序完全相同的等价组合
- 对每组唯一资源路径使用隔离的 interface bundle 和 MaaFramework Resource，并发运行 [@nekosu/maa-pipeline-manager](../../maa-pipeline-manager/models/) 诊断引擎与原生资源加载校验
- 应用用户配置的严重级别覆盖
- 按资源组发现顺序输出结果，不受并发完成顺序影响

`check.job` 控制最大并发资源组数，必须为大于等于 1 的整数；默认值为 CPU 可用并行度与 4 中的较小值。设置为 `1` 可关闭并发，但仍会合并等价资源组合。

```ts
const config: FullConfig = {
  // ...
  check: {
    job: 4,
    override: {
      'dynamic-image': 'ignore'
    }
  }
}
```

支持三种输出模式：

| 模式     | 说明                         |
| -------- | ---------------------------- |
| `stdio`  | 人类可读的终端输出（默认）   |
| `github` | GitHub Actions workflow 注解 |
| `json`   | 机器可读 JSON                |

### 2. 识别测试 (`test`)

运行图像识别测试：

```bash
npx @nekosu/maa-tools test [config-path]
```

- 加载 pipeline bundle
- 执行用户定义的测试用例（controller/resource/图像/期望节点）
- 按解析后的有序资源路径合并等价测试配置，每组复用一个 `workerpool` 并行执行
- 验证识别命中（可选 bounding box 约束；缺失识别框按不匹配处理）
- 按 controller/resource 排序后的稳定顺序输出成功/失败统计，不受资源组执行顺序影响

### 3. 项目初始化 (`init`)

生成 `maatools.config.mts` 脚手架配置：

```bash
npx @nekosu/maa-tools init
```

### 4. Pipeline Manager 转导出

通过 `@nekosu/maa-tools/pm` 子路径导出 `@nekosu/maa-pipeline-manager` 的完整 API。

> 此导出主要服务于自定义 custom reco/action 的 parser 配置。详情参见配置文档。

### 5. TypeScript 配置

`maatools.config.mts` 是 TypeScript 文件，通过 `jiti` 运行时加载，提供 IDE 类型检查和自动补全。

## 抽象边界

- CLI 不依赖 VSCode
- 配置通过 TypeScript 文件表达，支持条件类型和辅助函数

## MAA 日志目录

`check` 与 `test` 均通过 `maa.Global.log_dir` 设置 MaaFramework 日志输出目录，将其与工作区文件隔离，避免 MaaFramework 的日志轮转清理波及仓库内的 png 等图片（见 [TODO-23](../../TODO.md)）：

- **`check`**：默认写入 `<cwd>/debug`，可通过配置项 `maaLogDir` 覆盖（保持兼容，默认值由旧版的 `.` 改为 `debug`）
- **`test`**：经环境变量 `MAAFW_LOG_DIR` 传入 worker，默认 `<cwd>`，各 worker 进程在其下按 `maa-<pool>-<pid>` 子目录隔离
