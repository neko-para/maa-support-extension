# Maa Version Manager — 产品定义

## 包标识

- **npm 包名**: `@nekosu/maa-version-manager`
- **类型**: MaaFramework 版本管理库

## 目标用户

- `@mse/extension` — VSCode 插件中的版本切换功能
- `@nekosu/maa-tools` — CLI 工具的 MaaFramework 下载

## 核心能力

### 1. 版本发现

- **本地版本**: 列出 `install/` 目录中已安装的版本
- **远程版本**: 从 npm registry 查询 `@maaxyz/maa-node` 所有可用版本
- **最新版本**: 获取 `@latest` manifest

### 2. 版本安装

`prepare(version, progress)` 下载并安装指定版本：
- 下载 `@maaxyz/maa-node` 主包（JavaScript 脚本）
- 下载平台特定的二进制包 (`@maaxyz/maa-node-{platform}-{arch}`)
- 原子性移动到最终安装目录

> **技术限制**: 由于 `pacote` 的限制，`progress` 回调无法获取到下载本身的进度（如百分比）。回调仅报告阶段切换（`prepare-folder` → `download-scripts` → `download-binary` → `move-folders` → `finish`）。

### 3. Registry 管理

支持多个 npm registry 镜像：

```typescript
registries = {
  npm: 'https://registry.npmjs.org',
  cnpm: 'https://registry.npmmirror.com'
}
```

### 4. 并发安全

通过 `proper-lockfile` 文件锁保护所有文件系统操作，支持多进程并发访问。

### 5. 垃圾回收

`cleanUnused(skipVersions)` 自动删除 7 天未使用的版本，使用 `timestamp` 文件追踪。

## 抽象边界

- 不依赖 MaaFramework 本身
- 通过 npm registry 协议工作（`pacote`）
- 适用于任何需要动态管理 `@maaxyz/maa-node` 版本的场景
