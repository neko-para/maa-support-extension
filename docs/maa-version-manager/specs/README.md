# Maa Version Manager — 代码风格与约束

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用代码规范](../extra/common-specs.md)，以下为 version-manager 特有的补充。

## 环境

- Node.js

## 架构模式

### 锁优先并发

```typescript
async fetchAllVersions(minimumVersion) {
  const unlock = await this.lock()
  if (!unlock) return []
  try { /* 操作 */ }
  finally { await unlock() }
}
```

锁获取失败时返回空/fallback 结果，不抛异常。

### 时间戳 GC

每个版本目录包含 `timestamp` 文件，`cleanUnused()` 基于 7 天 TTL 清理。

### 原子安装

临时目录必须创建在 `install/` 下，使最终 `fs.rename()` 不跨文件系统。主包、平台二进制包和 `timestamp` 全部写入 staging 后才可提交。所有异常路径必须在 `finally` 中清理 staging 并释放文件锁。

## 外部接口

`MaaVersionManager` 类定义在 [src/index.ts](../../../pkgs/maa-version-manager/src/index.ts)。

详见源码。
