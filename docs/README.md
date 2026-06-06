# Maa Support Extension — 文档索引

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

VSCode 插件 + CLI 工具的 pnpm monorepo，服务于 MaaFramework 和 MaaAssistantArknights 的 pipeline 开发。

- **通用规范**: [extra/common-specs.md](extra/common-specs.md)
- **待处理问题**: [TODO.md](TODO.md)
- **待定疑问**: [../QUESTION.md](../QUESTION.md)

## 文档结构要求

每个包目录内含三个子目录：

| 目录 | 用途 |
|---|---|
| `models/` | 产品定义。描述该包对用户（最终用户或其他包）提供的能力和功能的抽象。 |
| `specs/` | 代码风格和约束（编码规范、命名约定等）。不包含接口的具体信息——若包有明确的"对外接口"概念，直接引导查看源代码。 |
| `tech/` | 技术架构。代码和技术层面的信息，如模块架构、依赖关系、技术选型等。 |

每个子目录默认放置 `README.md`。若内容过长或存在明显独立内容，可抽出单独文件，使用 `kebab-case` 命名。

`extra/` 目录按主题组织跨包内容，仅存放没有明确归属的共享内容。

## 包列表

### 面向用户

| 包 | 说明 | 文档 |
|---|---|---|
| `@mse/extension` | VSCode 插件主包 | [extension/](extension/) |
| `@mse/webview` | 插件网页（Vue 3） | [webview/](webview/) |
| `@nekosu/maa-tools` | CLI 检查器 | [maa-tools/](maa-tools/) |

### 核心引擎

| 包 | 说明 | 文档 |
|---|---|---|
| `@nekosu/maa-pipeline-manager` | 核心语法解析支持库 | [maa-pipeline-manager/](maa-pipeline-manager/) |
| `@nekosu/maa-tasker` | MAA 任务解析求值库 | [maa-tasker/](maa-tasker/) |
| `@nekosu/simple-parser` | LL\* 解析库 | [simple-parser/](simple-parser/) |

### 基础设施

| 包 | 说明 | 文档 |
|---|---|---|
| `@nekosu/maa-locale` | 共享国际化文案 | [maa-locale/](maa-locale/) |
| `@mse/maa-server` | MaaFramework 代理进程 | [maa-server/](maa-server/) |
| `@mse/maa-server-proto` | 通信协议定义 | [maa-server-proto/](maa-server-proto/) |
| `@nekosu/maa-version-manager` | MaaFramework 版本管理 | [maa-version-manager/](maa-version-manager/) |
| `@mse/types` | 共享类型和协议 | [types/](types/) |
| `@mse/utils` | 插件通用工具 | [utils/](utils/) |
| `@nekosu/prettier-plugin-maafw-sort` | Prettier 排序插件 | [prettier-plugin-maafw-sort/](prettier-plugin-maafw-sort/) |

## 跨包文档

参见 [extra/](extra/) 目录：

| 文档 | 说明 |
|---|---|
| [common-specs.md](extra/common-specs.md) | **通用代码规范**（所有包共享的 Prettier/ESLint/TS/命名约定） |
| [common-tech.md](extra/common-tech.md) | **通用技术约定**（模块系统、构建工具、依赖管理、包结构） |
| [dependency-graph.md](extra/dependency-graph.md) | 包依赖关系图 |
| [ipc-architecture.md](extra/ipc-architecture.md) | IPC 通信架构 |
| [locale-system.md](extra/locale-system.md) | 国际化文案体系 |
| [lsp-strategy/](extra/lsp-strategy/) | LSP 能力实现策略 |
| [pipeline-syntax.md](extra/pipeline-syntax.md) | Pipeline 语法双轨制 |
| [build-and-publish.md](extra/build-and-publish.md) | 构建与发布流程 |
