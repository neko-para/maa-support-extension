# Maa Version Manager — 技术架构

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用技术约定](../extra/common-tech.md)。零工作区依赖。

## 模块架构

单文件包，所有逻辑在 `src/index.ts`：

```
src/index.ts  (MaaVersionManager 类)
```

## 核心实现

### 目录结构

```
root/
├── download/         # 兼容保留的下载工作目录
└── install/          # 已安装版本和同文件系统 staging
    ├── .prepare-*/   # 未提交的安装临时目录
    └── {version}/
        ├── node_modules/@maaxyz/
        │   ├── maa-node/       # JavaScript 脚本
        │   └── maa-node-{platform}-{arch}/  # 原生二进制
        └── timestamp           # 最后使用时间
```

### 安装流程

```
1. 在首次 `await` 前捕获当前 registry
2. `lock()` 获取文件锁
3. 检查最终目录中的 `timestamp`、主包和平台二进制包；完整则仅刷新时间戳
4. 删除同版本的旧半成品，在 `install/.prepare-*` 创建 staging 目录
5. 使用同一 registry 快照将 `@maaxyz/maa-node@version` 和平台二进制包解压到 staging
6. 在 staging 中写入 `timestamp`
7. 在同一文件系统内原子 `rename` 为 `install/{version}`
8. `finally` 清理未提交的 staging，关闭进度并释放文件锁
```

### Registry 状态

构造函数负责注入初始 registry，公开的 `registry` 属性保留运行时切换能力。所有使用网络的公开操作在入口处捕获该值，再等待锁并执行请求；因此一次操作只依赖一个不可变快照，切换 registry 仅影响之后开始的操作。

## 依赖关系

| 包                | 用途                |
| ----------------- | ------------------- |
| `pacote`          | npm registry 客户端 |
| `proper-lockfile` | 跨进程文件锁        |
| `semver`          | 版本号比较          |

## 技术选型

| 选择                       | 理由                                                       |
| -------------------------- | ---------------------------------------------------------- |
| `pacote`                   | 官方 npm 客户端库，可靠处理 registry 协议                  |
| `proper-lockfile`          | 跨平台文件锁，防止并发安装冲突                             |
| 同盘 staging + 原子 rename | 临时目录位于 `install/` 下，避免跨设备移动并防止暴露半成品 |
| 7 天 GC                    | 平衡磁盘使用和便利性                                       |
| Lock-first 模式            | 允许多进程（多个 VSCode 窗口）安全共享                     |
| 操作级 registry 快照       | 防止运行时切换镜像使同一查询或安装混用不同来源             |
