# Webview — 技术架构

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本包遵循 [通用技术约定](../extra/common-tech.md)。使用 Vite 构建（浏览器环境），而非 tsdown。

## 模块架构

```
src/
├── control/                # 控制面板应用
│   ├── main.ts             # Vue app 入口
│   ├── App.vue             # 根组件 (Naive UI config provider)
│   ├── state.ts            # 浅响应式 IPC 快照 (hostState, interfaceJson)
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

## Crop Canvas 渲染调度

Crop Canvas 采用按需渲染：Vue reactive effect 跟踪 `draw()` 读取的图像、视口、选框、设置、主题背景色和识别结果等状态，状态变更后由 `requestAnimationFrame` 合并到下一浏览器帧绘制。画面静止时不重绘；仅获得焦点的轮廓选区虚线动画会连续请求帧。Webview 隐藏时取消待处理帧，恢复可见后主动补绘。

绿色蒙版直接以绿色像素保存在独立 Canvas 中，并通过 `triggerRef()` 通知主 Canvas 失效；主绘制流程直接叠加该 Canvas，避免每帧创建原图尺寸的临时 Canvas。切换图像时会释放旧蒙版及其历史记录。

`theme.ts` 将 `--vscode-editor-background` 解析为 Canvas 可直接使用的颜色字符串，并通过 `editorBackgroundColor` ref 共享；主题变化时该 ref 更新并触发 Crop Canvas 重绘。用户不能为 Crop Canvas 单独配置背景色。

## Control Panel 状态同步

Control Panel 将低频变化但可能较大的 `interfaceJson` 与常规 `hostState` 分成 `updateInterface`、`updateState` 两种 IPC 消息。配置修改、服务状态变化等只重发 `hostState`；仅 interface 主文件或 import 变化时才重发合并后的 interface 快照。

Webview 将两份 IPC 数据都视为不可变快照，并使用 `shallowRef` 保存。消息到达时替换整个 `.value` 以触发视图更新，不对 interface、任务配置等嵌套对象创建深层响应式代理。组件不得直接修改快照；所有配置变更通过 IPC 交给 extension host，等待下一份快照回传。文本型任务选项保留 500ms debounce，以合并高频输入产生的配置写入和 state 回传。

## Locale 状态

Webview 的 `utils/locale` 使用 Vue `ref` 保存 VS Code locale，并通过 `computed` 选择字典，使 control、launch、crop 三个应用在 host state 更新后响应式重绘。其字典只包含浏览器 UI 文案，与 `@nekosu/maa-locale` 没有相同 key；后者的模块级状态面向 extension host 和 CLI，因此不作为 Webview 依赖。完整边界见 [locale-system.md](../../extra/locale-system.md)。

## 依赖关系

### 工作区依赖

| 包                             | 角色                                    |
| ------------------------------ | --------------------------------------- |
| `@nekosu/maa-types`            | IPC 协议类型                            |
| `@nekosu/maa-pipeline-manager` | 运行时构建（仅在 control panel 中使用） |

### 外部依赖

| 包                                              | 用途                           |
| ----------------------------------------------- | ------------------------------ |
| `vue` 3.5                                       | UI 框架                        |
| `naive-ui` 2.43                                 | 组件库                         |
| `highlight.js`                                  | 语法高亮                       |
| `@vicons/material`                              | Material Design 图标           |
| `prettier`                                      | JSON 实时格式化 (JsonCode.vue) |
| `buffer`                                        | Buffer polyfill (crop tool)    |
| `vite` 7.3                                      | 构建工具                       |
| `@vitejs/plugin-vue` + `@vitejs/plugin-vue-jsx` | Vite Vue 支持                  |

## 技术选型

| 选择                        | 理由                                             |
| --------------------------- | ------------------------------------------------ |
| Vue 3 + Composition API     | 响应式 UI，composition API 便于逻辑复用          |
| Naive UI                    | Tree-shaking 友好，内置主题系统适配 VS Code 变量 |
| Vite 多页面构建             | 三个独立应用无需路由，分别打包                   |
| `forward.html` 代理         | 实现 Vite HMR 在 VS Code webview 沙箱中运行      |
| `useIpc()` composable       | 统一的类型安全 IPC 抽象                          |
| `MutationObserver` 主题同步 | 实时响应 VS Code 主题变化                        |
| 按需 Canvas + rAF 调度      | 合并高频交互绘制，静止或隐藏时停止无效重绘       |
| Prettier 在线格式化         | `JsonCode.vue` 实时美化 JSON 显示                |
