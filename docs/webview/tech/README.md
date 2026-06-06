# Webview — 技术架构

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 模块架构

```
src/
├── control/                # 控制面板应用
│   ├── main.ts             # Vue app 入口
│   ├── App.vue             # 根组件 (Naive UI config provider)
│   ├── state.ts            # 响应式状态 (hostState, interfaceJson)
│   │                       #   + computed runtimes via pipeline-manager/logic
│   ├── ipc.ts              # Typed IPC: useIpc<ControlHostToWeb, ControlWebToHost>()
│   ├── views/              # 主视图
│   │   ├── ControllerView.vue
│   │   ├── EvalView.vue
│   │   ├── InterfaceView.vue
│   │   ├── LaunchView.vue
│   │   ├── ResourceView.vue
│   │   ├── TaskView.vue
│   │   └── ToolkitView.vue
│   └── components/         # UI 组件
│       ├── TaskCard.vue
│       ├── TaskCheckboxOption.vue
│       ├── TaskInputOption.vue
│       ├── TaskInputOptionItem.vue
│       ├── TaskOptionHeader.vue
│       ├── TaskSelectOption.vue
│       ├── TaskSwitchOption.vue
│       └── LocaleText.vue
├── crop/                   # 裁剪工具应用
│   ├── main.ts             # Vue app 入口 + Buffer polyfill
│   ├── App.vue             # 根组件 (Canvas-based + Naive UI card)
│   ├── state.ts            # CropHostState
│   ├── ipc.ts              # Typed IPC
│   ├── states/             # 状态模块
│   │   ├── canvas.ts       # Canvas 画布状态
│   │   ├── control.ts      # 控制逻辑
│   │   ├── greenMask.ts    # 绿色蒙版
│   │   ├── image.ts        # 图像状态
│   │   ├── pick.ts         # 选取逻辑
│   │   ├── reco.ts         # 识别状态
│   │   ├── settings.ts     # 可视化设置
│   │   ├── visible.ts      # 可见性状态
│   │   └── quickMatch.ts   # 快速匹配
│   ├── views/              # 视图
│   │   ├── ControlView.vue
│   │   ├── ToolView.vue
│   │   └── SettingsView.vue
│   └── components/         # 组件
│       ├── ColorBox.vue
│       ├── RoiEdit.vue
│       ├── SettingsInput.vue
│       ├── SettingsInputNumber.vue
│       ├── SettingsSwitch.vue
│       └── RecoDetail.vue
├── launch/                 # 启动面板应用
│   ├── main.ts             # Vue app 入口 + analyzerBridge 初始化
│   ├── App.vue             # 根组件 (LaunchControlBar + AnalyzerFrame)
│   ├── state.ts            # LaunchHostState
│   ├── ipc.ts              # Typed IPC
│   ├── states/
│   │   └── analyzer.ts     # LaunchAnalyzerBridge (982 行)
│   │                       #   - JSON-RPC 2.0 双向通信
│   │                       #   - 实时事件流 (debounced, 80ms 间隔, 200 批量上限)
│   │                       #   - 快照回放
│   │                       #   - 详情查询 (含缓存图像)
│   │                       #   - 键盘转发
│   └── components/
│       ├── AnalyzerFrame.vue   # iframe 宿主
│       ├── LaunchControlBar.vue # 暂停/停止/断点控制
│       └── InputTask.vue       # 断点任务输入
├── utils/                  # 共享工具
│   ├── ipc.ts              # useIpc() 泛型 composable
│   ├── locale/             # 独立 locale 系统
│   │   ├── index.ts
│   │   ├── locale.zh-cn.ts
│   │   ├── locale.en.ts
│   │   └── locale.d.ts
│   ├── theme.ts            # useTheme() composable
│   ├── tooltip.ts          # tooltipDisabled ref
│   ├── tools.ts            # debounce()
│   └── base.css            # 基础样式
└── components/             # 跨应用共享组件
    ├── AppTooltip.vue
    └── JsonCode.vue        # Prettier 实时格式化 JSON
```

## 构建

```
Vite (vite.config.ts)
  ├── control.html → control/
  ├── launch.html  → launch/
  ├── crop.html    → crop/
  └── output: ../../release/webview/
```

## 依赖关系

### 工作区依赖

| 包 | 角色 |
|---|---|
| `@mse/types` | IPC 协议类型 |
| `@nekosu/maa-pipeline-manager` | 运行时构建（仅在 control panel 中使用） |

### 外部依赖

| 包 | 用途 |
|---|---|
| `vue` 3.5 | UI 框架 |
| `naive-ui` 2.43 | 组件库 |
| `immer` | 不可变状态更新 |
| `highlight.js` | 语法高亮 |
| `@vicons/material` | Material Design 图标 |
| `prettier` | JSON 实时格式化 (JsonCode.vue) |
| `buffer` | Buffer polyfill (crop tool) |
| `vite` 7.3 | 构建工具 |
| `@vitejs/plugin-vue` + `@vitejs/plugin-vue-jsx` | Vite Vue 支持 |

## 技术选型

| 选择 | 理由 |
|---|---|
| Vue 3 + Composition API | 响应式 UI，composition API 便于逻辑复用 |
| Naive UI | Tree-shaking 友好，内置主题系统适配 VS Code 变量 |
| Vite 多页面构建 | 三个独立应用无需路由，分别打包 |
| `forward.html` 代理 | 实现 Vite HMR 在 VS Code webview 沙箱中运行 |
| `useIpc()` composable | 统一的类型安全 IPC 抽象 |
| `MutationObserver` 主题同步 | 实时响应 VS Code 主题变化 |
| Prettier 在线格式化 | `JsonCode.vue` 实时美化 JSON 显示 |
| `immer` | 简化不可变状态更新 |
