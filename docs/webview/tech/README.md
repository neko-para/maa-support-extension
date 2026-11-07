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
│   │   ├── control.ts      # 控制逻辑（指针/键盘事件、ROI、请求用 ROI）
│   │   ├── mode.ts         # 画布单一操作模式（点选/框选/涂绿/圈选互斥）
│   │   ├── greenMask.ts    # 手绘绿色蒙版、生成方式与「应用/撤销应用」快照
│   │   ├── autoMask.ts     # 自动去背景：ROI 内背景估计 + 预览
│   │   ├── subjectSelect.ts # 圈选主体：手画区域与区域 mask
│   │   ├── subjectMask.ts  # 圈选主体：颜色模型生成绿幕
│   │   ├── maskApply.ts    # 绿幕统一预览联动与「应用到图像」（不参与状态模块循环导入）
│   │   ├── colorPreview.ts # 取色推荐范围的命中预览
│   │   ├── image.ts        # 图像状态与图片历史
│   │   ├── pick.ts         # 取色与推荐范围
│   │   ├── reco.ts         # 节点识别测试结果
│   │   ├── settings.ts     # 可视化设置
│   │   ├── visible.ts      # 面板布局偏好（右栏面板 / 展开区块 / 识别目标，写回 CropSettings）
│   │   └── quickMatch.ts   # 一次性识别（OCR/模板/ColorMatch）
│   ├── utils/
│   │   ├── 2d.ts           # Pos/Size/Box/Viewport
│   │   ├── copy.ts         # 写剪贴板 + 短暂的「已复制」状态
│   │   ├── recoDetail.ts   # 识别详情字段取值与一行摘要
│   │   ├── detect.ts       # 选框角/边命中检测
│   │   ├── autoMaskCore.ts # 自动涂绿纯函数（背景估计、边缘泛洪、外扩）
│   │   └── subjectMaskCore.ts # 圈选主体纯函数（K-means 颜色模型、碎片清理、填洞）
│   ├── views/              # 视图
│   │   ├── ControlView.vue
│   │   ├── ToolView.vue
│   │   └── SettingsView.vue
│   └── components/         # 组件
│       ├── ColorBox.vue
│       ├── CopyChip.vue    # 「标签 + 等宽值」的可复制小块
│       ├── ParamRow.vue    # 参数行（中文名 + pipeline 字段名 + 控件）
│       ├── HistoryStrip.vue
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

test/                       # node --test 单测（纯函数，不依赖 DOM）
├── autoMaskCore.test.ts
└── subjectMaskCore.test.ts
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

Crop 的状态模块之间存在循环导入（`image` ↔ `control` 等）。ES 模块按依赖深度优先求值，模块顶层（包括 `watch()` 的 source getter）不能读取尚未求值完的模块，否则会触发 TDZ 报错。需要跨模块联动时，由先求值的一方调用后求值一方导出的函数，例如 `image.ts` 在切换图像时调用 `subjectSelect` / `quickMatch` / `reco` 的 `resetForImageChange`。

`maskApply.ts` 汇总三种绿幕来源：各来源模块只提供 `paintInto(ImageData)`（把自己的绿色写进整图像素），应用时由 `maskApply` 叠加后一次 `imageSt.set`，并记录「撤销应用」快照。它依赖 `visible.ts` 判断绿幕区块是否可见，只被 `canvas.ts` 和组件引用，因此不在状态模块的循环导入链里，模块顶层的 `watch` 可以安全读取其他状态模块。

快速匹配与节点识别的结果都记录了产生它的图像；切换图像或识别期间换图时会丢弃旧结果，避免把旧图的识别框画到新图上。识别框全部由 `RecoDetail.vue` 的 draw step 绘制（受「在画布上标出」开关控制），`canvas.ts` 不再单独绘制快速匹配结果。

画布在图像尺寸变化时调用 `fitViewport()` 适应窗口；若图像先于画布布局到达（画布尺寸仍为 0），会等 ResizeObserver 给出尺寸后再适应。

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
