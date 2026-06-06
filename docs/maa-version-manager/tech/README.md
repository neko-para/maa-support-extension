# Maa Version Manager — 技术架构

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 模块架构

单文件包，所有逻辑在 `src/index.ts`：

```
src/index.ts  (MaaVersionManager 类)
```

## 核心实现

### 目录结构

```
root/
├── download/         # 下载临时目录
│   └── .lock         # proper-lockfile 锁文件
└── install/          # 已安装版本
    └── {version}/
        ├── node_modules/@maaxyz/
        │   ├── maa-node/       # JavaScript 脚本
        │   └── maa-node-{platform}-{arch}/  # 原生二进制
        └── timestamp           # 最后使用时间
```

### 安装流程

```
1. lock() → 获取文件锁
2. 从 registry 下载 @maaxyz/maa-node@version
3. 解压到 download/scripts/
4. 从 registry 下载 @maaxyz/maa-node-{platform}-{arch}@version
5. 解压到 download/binary/
6. rename download/scripts → install/{version}/node_modules/@maaxyz/maa-node
7. rename download/binary → install/{version}/node_modules/@maaxyz/maa-node-{platform}-{arch}
8. 写入 timestamp 文件
9. unlock() → 释放文件锁
```

## 依赖关系

### 外部依赖

| 包 | 用途 |
|---|---|
| `pacote` | npm registry 客户端 (`packument()`, `extract()`) |
| `proper-lockfile` | 跨进程文件锁 |
| `semver` | 版本号比较 |

零工作区依赖。

## 技术选型

| 选择 | 理由 |
|---|---|
| `pacote` | 官方 npm 客户端库，可靠处理 registry 协议 |
| `proper-lockfile` | 跨平台文件锁，防止并发安装冲突 |
| 原子 rename | 同文件系统内 rename 是原子的，防止安装中断导致损坏 |
| 7 天 GC | 平衡磁盘使用和便利性 |
| Lock-first 模式 | 允许多进程（多个 VSCode 窗口）安全共享 |
