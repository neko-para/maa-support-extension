# Types — 技术架构

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 模块架构

```
src/
├── index.ts                  # Re-export barrel
├── logger.ts                 # LogCategory 类型
└── webview/
    ├── base.ts               # 通用协议基类型
    │                         #   HostToWeb<Impl>, WebToHost<Impl>
    │                         #   HostStateBase, ImplType
    ├── control.ts            # Control panel 协议
    │                         #   ControlHostState, ControlHostToWeb,
    │                         #   ControlWebToHost (20+ 命令)
    ├── crop.ts               # Crop tool 协议
    │                         #   CropSettings, CropHostToWeb,
    │                         #   CropWebToHost (10+ 命令)
    └── launch.ts             # Launch panel 协议
                              #   LaunchHostState, LaunchHostToWeb,
                              #   LaunchWebToHost (10+ 命令),
                              #   RealtimeStartParams, RecoInfo, ActionInfo
```

## 协议流

```
┌──────────────────┐                      ┌──────────────────┐
│   extension      │                      │   webview        │
│   (Host)         │                      │   (Vue App)      │
│                  │  HostToWeb ────────→  │                  │
│                  │  ←─────── WebToHost   │                  │
│                  │                      │                  │
│   Control:       │                      │   Control:       │
│   updateState    │  ────────────────→   │   hostState      │
│   updateInterface│  ────────────────→   │   interfaceJson  │
│                  │  ←────────────────   │   selectInterface│
│                  │  ←────────────────   │   launch         │
│                  │                      │                  │
│   Launch:        │                      │   Launch:        │
│   updateState    │  ────────────────→   │   state          │
│   realtimeStart  │  ────────────────→   │   analyzerBridge │
│   notifyStatus   │  ────────────────→   │   controlBar     │
│                  │  ←────────────────   │   requestStop    │
│                  │                      │                  │
│   Crop:          │                      │   Crop:          │
│   updateState    │  ────────────────→   │   settings       │
│   setImage       │  ────────────────→   │   image          │
│                  │  ←────────────────   │   requestOCR     │
└──────────────────┘                      └──────────────────┘
```

## 依赖关系

### 工作区依赖

| 包 | 角色 |
|---|---|
| `@nekosu/maa-pipeline-manager` | 运行时类型引用 |
| `@maaxyz/maa-node` | MAA 原生类型引用 |

### 外部依赖

无。

## 技术选型

| 选择 | 理由 |
|---|---|
| 无构建步骤 | 不对外发布，由消费方 bundler 直接链接 TypeScript 源码 |
| 可辨识联合 | TypeScript 类型收窄，编译期完整性检查 |
| 泛型协议基类 | 重用内置命令逻辑，避免三个 panel 协议重复 |
| `seq` request-response | 支持异步请求-响应，避免回调地狱 |
