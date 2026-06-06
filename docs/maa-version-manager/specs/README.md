# Maa Version Manager — 代码风格与约束

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
  finally { unlock() }
}
```

锁获取失败时返回空/fallback 结果，不抛异常。

### 时间戳 GC

每个版本目录包含 `timestamp` 文件，`cleanUnused()` 基于 7 天 TTL 清理。

### 原子安装

先下载到临时目录，最后 `fs.rename()` 原子移动到目标目录。

## 外部接口

`MaaVersionManager` 类定义在 [src/index.ts](../../../pkgs/maa-version-manager/src/index.ts)。

详见源码。
