# Maa Pipeline Manager — 代码风格与约束

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用代码规范](../extra/common-specs.md)，以下为 pipeline-manager 特有的补充。

## 命名约定

### 品牌化类型 (Branded Types)

轻量级名义类型系统，防止路径/名称混淆：

```typescript
type TaskName = string & { __brand: 'TaskName' }
type AbsolutePath = string & { __brand: 'AbsolutePath' }
type RelativePath = string & { __brand: 'RelativePath' }
type AnchorName = string & { __brand: 'AnchorName' }
type ImageRelativePath = string & { __brand: 'ImageRelativePath' }
```

### 接口命名

使用 `I` 前缀：`IContentLoader`、`IContentWatcher`。

## 架构模式

### 事件驱动

`Bundle`、`InterfaceBundle`、`LanguageBundle` 均继承 `EventEmitter`，使用类型化事件映射。

> **历史遗留问题**: 事件驱动架构导致 checker 侧使用困难——checker 需要的是同步的一次性结果，而非持续的变更事件流。

### 生成器函数

`parseObject`、`parseArray` 等使用生成器函数进行惰性 AST 遍历，允许提前终止。

### Debounce 批量处理

`BundleManager` 和 `ContentJson` 使用 `setTimeout` + `process.nextTick` 合并快速连续的文件系统事件。

### 脏标记缓存

`LayerInfo.mergedDecls` / `mergedRefs` 使用懒计算 + `dirty` 失效策略。

### 源码保真编辑

不得使用已弃用的 `LayerInfo.toggleMode()` 实现编辑器操作。该方法只有去除 parent 后的 JSON AST，没有原始文本，重新序列化时无法保留 JSONC 注释；需要源码保真的转换必须基于调用方持有的原始文档执行局部编辑。

### 可辨识联合类型

所有声明和引用类型使用 `type` 字段作为判别键——parser 下每种 ref 和 decl 均有独立的类型变体。

自定义 reco/action parser 产出的引用使用 `task.custom_*` 判别类型，以保留自定义处理器名称、reco/action 来源和缺失策略；这些引用仍必须与标准引用写入同一个 `TaskInfo.refs`，并参与 Layer 合并、诊断和语言功能。所有 `InterfaceBundle` 解析入口（主文件与 import）都必须转发当前 `ParserConfig`。

### 接口+实现分离

Content loader/watcher 使用接口抽象，以支持 Node.js host 内的测试注入和内容源替换。该接口不代表完整文件编排层可运行于浏览器。

### 入口约束

- Node.js 消费者需要 parser、bundle、diagnostic 或文件监视时，从包主入口导入。
- 浏览器消费者只能从 `@nekosu/maa-pipeline-manager/logic` 导入。
- `logic/` 不得导入 `node:*`、chokidar、content、bundle、interface 编排或其他依赖 Node.js 的模块。

## 外部接口

本包对外的核心 API 定义在 [src/index.ts](../../../pkgs/maa-pipeline-manager/src/index.ts) 和 [src/logic/index.ts](../../../pkgs/maa-pipeline-manager/src/logic/index.ts)（`./logic` 子路径）。

详细的 API 签名单参见源码中的类型定义和 JSDoc。
