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

### Filepath 模式匹配与内容探测

通过 `filepath` 参数匹配正则表达式，决定使用 pipeline 模式还是 interface 模式。pattern 均未命中时按强信号内容探测判定是否为 interface 文件（`maafwInterfaceDetect` 可关闭）：`task`/`controller`/`resource`/`preset` 数组中存在含字符串 `name` 与对应标志 key（`entry`/`type`/`path`/`task`）的条目，或 `option` Record 存在含 `cases`/`inputs`/`hotkeys`/`default_case`/`pipeline_override` 的条目。探测对任意路径生效，pattern 只增加显式覆盖、不能关闭探测。详见 [tech/README.md](../tech/README.md)。

排序只重排对象 key；数组顺序一律不动（interface 各数组顺序有协议语义）。

## 外部接口

Prettier 标准插件导出：

- `parsers` — 覆盖 `json` 和 `jsonc`
- `options` — `maafwPipelinePatterns`、`maafwInterfacePatterns`、`maafwLocalePatterns`、`maafwInterfaceDetect`
- `patchPlugin(plugin)` — 插件合并工具

详见 [src/index.ts](../../../pkgs/prettier-plugin-maafw-sort/src/index.ts) 和 [src/parser.ts](../../../pkgs/prettier-plugin-maafw-sort/src/parser.ts)。
