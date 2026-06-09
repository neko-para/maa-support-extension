# CLAUDE.md

## 工作流程

**先文档，后代码。** 在任何实质性操作之前，必须先阅读文档获取项目概况和上下文：

1. 首先阅读 [AGENTS.md](./AGENTS.md) 了解项目约定
2. 通过 [docs/README.md](docs/README.md) 了解项目结构和各包职责
3. 根据任务定位到对应包的文档目录（`models/` → 产品定义，`tech/` → 技术架构，`specs/` → 编码规范）
4. 阅读相关的 `docs/extra/` 跨包文档
5. 以上文档阅读完毕后，**再去阅读源代码**

对于跨包/跨模块的分析任务（如 LSP 策略、解析器设计），`docs/extra/` 中的专题文档应优先于源码阅读。

**代码修改完成后**，按以下顺序验证和格式化：

1. 验证类型和 lint：`tsc -p tsconfig.json --noEmit`，`npx eslint <改动的文件> --max-warnings 0`
2. 运行测试（如有 vitest）：`vitest run`
3. 格式化代码：`npx prettier -w <改动的代码文件>`（不格式化 `.md` 文档）
