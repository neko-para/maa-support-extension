# Maa Server Proto — 技术架构

## 模块架构

```
src/
├── index.ts          # Re-export barrel
├── declares.ts       # RPC channel 常量 (运行时)
│                     #   initNoti, logNoti, shutdownNoti,
│                     #   hostToSubReq, subToHostReq
└── apis.ts           # API 类型定义 (纯类型，零运行时代码)
                      #   HostToSubApis, SubToHostApis,
                      #   MarkApis, MarkApisImpl, MarkReturnPromise
```

## 协议连接方式

```
┌─────────────┐                    ┌─────────────┐
│  extension  │ ←── TCP ───→       │  maa-server  │
│  (Host)     │                    │  (Sub)       │
│             │ hostToSubReq ──→   │             │
│             │ ←── subToHostReq   │             │
│             │ ←── initNoti       │             │
│             │ ←── logNoti        │             │
│             │ ←── shutdownNoti   │             │
└─────────────┘                    └─────────────┘
         │                                  │
         └──── @mse/maa-server-proto ──────┘
              (共享类型和 channel 常量)
```

## 依赖关系

### 工作区依赖

| 包 | 角色 |
|---|---|
| `@mse/types` | 共享类型 |
| `@nekosu/maa-pipeline-manager` | 运行时类型 (`ControllerRuntime`, `InterfaceRuntime`) |

### 外部依赖

| 包 | 用途 |
|---|---|
| `vscode-jsonrpc` | `NotificationType`, `RequestType` 泛型类型（运行时依赖） |
| `@maaxyz/maa-node` | MAA 原生类型引用（类型依赖） |

## 技术选型

| 选择 | 理由 |
|---|---|
| 纯类型库 | 协议定义不需要运行时逻辑 |
| `vscode-jsonrpc` 实例导出 | 两端共享相同的 RPC channel 对象，确保消息名称一致 |
| 工具类型 (`Mark*`) | 编译期保证 IPC Proxy 的类型安全 |
| `Promise<... \| null>` | 统一处理远程调用失败 |
