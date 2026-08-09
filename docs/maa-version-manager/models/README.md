# Maa Version Manager — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

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
- 在 `install/` 下的临时目录完成解压，再原子提交到最终安装目录
- 仅当时间戳、主包和平台二进制包均存在时，才复用已安装版本
- 下载或提交失败时返回 `false`，删除临时/半成品目录并释放文件锁

> **技术限制**: 由于 `pacote` 的限制，`progress` 回调无法获取到下载本身的进度（如百分比）。回调仅报告阶段切换（`prepare-folder` → `download-scripts` → `download-binary` → `move-folders` → `finish`）。`finish` 表示本次尝试结束，成功与否以返回值为准。

### 3. Registry 管理

支持多个 npm registry 镜像：

```typescript
registries = {
  npm: 'https://registry.npmjs.org',
  cnpm: 'https://registry.npmmirror.com'
}
```

构造函数可接收初始 registry；不传时使用 npm 官方源。`registry` 属性仍可修改，但每个远程查询或安装操作会在调用入口捕获一次当前值：修改只影响之后开始的操作，不会让正在执行的操作中途换源。一次 `prepare()` 下载的主包与平台二进制包始终使用同一 registry 快照。

### 4. 并发安全

通过 `proper-lockfile` 文件锁保护所有文件系统操作，支持多进程并发访问。安装流程在成功、失败和回调异常路径上都会尝试释放锁。

### 5. 垃圾回收

`cleanUnused(skipVersions)` 自动删除 7 天未使用的版本，使用 `timestamp` 文件追踪。

## 抽象边界

- 不依赖 MaaFramework 本身
- 通过 npm registry 协议工作（`pacote`）
- 适用于任何需要动态管理 `@maaxyz/maa-node` 版本的场景
