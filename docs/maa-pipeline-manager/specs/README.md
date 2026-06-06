# Maa Pipeline Manager — 代码风格与约束

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

### 可辨识联合类型

所有声明和引用类型使用 `type` 字段作为判别键——parser 下每种 ref 和 decl 均有独立的类型变体。

### 接口+实现分离

Content loader/watcher 使用接口抽象，设计意图是支持测试注入和跨平台替换。

## 外部接口

本包对外的核心 API 定义在 [src/index.ts](../../../pkgs/maa-pipeline-manager/src/index.ts) 和 [src/logic/index.ts](../../../pkgs/maa-pipeline-manager/src/logic/index.ts)（`./logic` 子路径）。

详细的 API 签名单参见源码中的类型定义和 JSDoc。
