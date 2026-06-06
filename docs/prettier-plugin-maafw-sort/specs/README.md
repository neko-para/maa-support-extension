# Prettier Plugin Maafw Sort — 代码风格与约束

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用代码规范](../extra/common-specs.md)，以下为 plugin 特有的补充。

## 环境

- Node.js（Prettier 运行环境）

## 架构模式

### AST 后处理

1. Prettier 的标准 babel JSON 解析器解析源文件
2. 后处理函数遍历 AST，调用 `sortObject()` 重排属性
3. 将修改后的 AST 返回给 Prettier 进行格式化

### Filepath 模式匹配

通过 `filepath` 参数匹配正则表达式，决定使用 pipeline 模式还是 interface 模式。

## 外部接口

Prettier 标准插件导出：

- `parsers` — 覆盖 `json` 和 `jsonc`
- `options` — `maafwPipelinePatterns`、`maafwInterfacePatterns`
- `patchPlugin(plugin)` — 插件合并工具

详见 [src/index.ts](../../../pkgs/prettier-plugin-maafw-sort/src/index.ts) 和 [src/parser.ts](../../../pkgs/prettier-plugin-maafw-sort/src/parser.ts)。
