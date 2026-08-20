# Extension — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 包标识

- **npm 包名**: `@mse/extension`
- **发布名称**: `nekosu.maa-support`（VSCode Marketplace 和 Open VSX）
- **类型**: VSCode 插件

## 目标用户

MaaFramework 的 pipeline 开发者。用户通过 VSCode 编辑 JSON/JSONC 格式的 pipeline 定义文件。

> **注意**: 本插件对 MaaAssistantArknights 的支持是**有限的**。MaaAssistantArknights 的 pipeline JSON 语法与 MaaFramework V2 不完全相同，且其静态语法分析由官方 JSON Schema 实现，不属于本插件的业务范围。下文标注 🄼 的功能为 MaaAssistantArknights 专用。

## 核心能力

### 1. 语义化 Pipeline 编辑

在 `interface.json` 和 pipeline JSON/JSONC 文件中提供完整的语言服务：

- **跳转定义**：从任务引用跳转到任务声明
- **查找引用**：查找任务在 pipeline 中的所有引用位置
- **自动补全**：任务名、图片路径、locale key 的上下文补全
- **悬停提示**：显示任务文档，以及 interface/pipeline 中的 resolved locale 值
- **内联提示**：显示 locale 翻译值和任务文档
- **Code Lens**：切换 resource/locale 的快捷操作
- **诊断**：任务验证、图片路径验证、配置冲突检测
- **文档链接**：在 pipeline 文件中提供可点击的资源路径链接
- **工作区符号**：跨文件搜索任务定义
- **文档颜色**：任务中的颜色值可视化
- **Code Action**：将可本地化文本提取到 locale 文件

> 注意：pipeline JSON 的静态语法分析（schema 验证）由官方 JSON Schema 实现，不属于本插件的业务。

插件不提供 MaaFramework Pipeline V1/V2 自动转换：两种格式可由 MaaFramework 兼容并在同一 pipeline 中共存，而整任务重写会丢失 JSONC 注释。

### 2. 控制面板（Webview）

通过活动栏侧边面板提供类 MaaPiCli 的控制界面：

- 选择 controller、resource、task
- 开关 admin 模式（仅 Windows UAC 提权）、debug 模式
- 配置 ADB/Win32/PlayCover 等控制器参数
- 管理任务队列（添加、删除、配置选项）
- 启动/停止任务执行
- 上传图片
- 应用预设配置
- 切换 MaaFramework 版本
- 表达式求值（MaaExpression）🄼；求值失败时提示去重后的阻断任务。名称包含 `@` 但后缀基任务不存在时仍按普通任务求值，不额外警告

### 3. 启动面板（Webview）

实时任务执行状态监控：

- 显示当前执行的任务节点
- 暂停/继续/停止控制
- 任务断点管理
- 外部分析器集成（iframe JSON-RPC）— 对接 [MaaLogAnalyzer](https://github.com/MaaXYZ/MaaLogAnalyzer)
- 识别结果详情查看

### 4. 裁剪工具（Webview）

基于截图的图像工具：

- 截图捕获（通过连接的 MaaFramework runtime）
- `maa.screencap` 命令可将截图直接保存到运行资源项目的 `debug/screenshot`，文件名使用 ISO 时间戳
- 同一资源项目有多个运行实例时，`maa.screencap` 只截取最近启动实例；不同资源项目同时运行时拒绝截图
- Jimp 图像裁剪
- OCR 识别
- 模板匹配
- 任务识别测试
- 识别结果详情查看
- `maa.open-crop` 命令可由其他 VS Code 插件调用；可选参数 `{ image, detail }` 中，`image` 为 data URL，`detail` 为 `maa.RecoDetailWithoutDraws`。省略参数时仍打开空白裁剪工具；成功时返回 `{ opened, imageAccepted, detailAccepted }`
- VS Code Explorer 中的 `.png` 文件可通过右键菜单调用 `maa.open-crop`，命令会读取目标文件并将图像直接载入裁剪工具

### 5. MaaFramework 版本管理

- 从 npm registry 下载 `@maaxyz/maa-node` 各版本
- 支持 registry 镜像切换（npm/cnpm）；选择会直接作用于后续版本查询和下载，已经开始的操作继续使用启动时的镜像
- 在已安装版本间切换
- 自动清理过期版本（7 天未使用）
- 通过状态栏显示当前版本和连接状态

### 6. MaaFramework 调试图像

- 控制面板工具栏的“保存识别绘图”按钮控制是否将识别绘制图像保存到当前 MAA 日志目录的 `vision/` 子目录，默认关闭
- 控制面板是该选项唯一的用户配置入口，状态保存在当前 VS Code 工作区
- 启用后可能产生大量图像并占用较多磁盘空间
- 配置变更会终止当前 MaaFramework 运行实例，并在下次使用时按新配置启动

### 7. 自定义调试适配器

提供 `maa-launch` 调试类型，将任务执行映射到 VSCode 调试视图：

- 暂停 ⇔ 暂停任务
- 继续 ⇔ 继续任务
- 断开 ⇔ 停止任务
- 在任务上设置断点

### 8. 全局快捷键控制

- `maa.start` 在快捷键目标窗口中启动当前资源项目配置的任务
- `maa.toggle-pause`、`maa.stop` 和 `maa.screencap` 控制该窗口中的运行实例；切换暂停时，存在未暂停实例则全部暂停，否则全部继续
- 控制面板可将当前窗口设为唯一快捷键目标；后激活窗口会取得租约，异常退出后租约自动失效
- VS Code 1.128 及以上可在用户 `keybindings.json` 中配置 `systemWide: true`；插件不提供默认系统快捷键

### 9. Agent 子进程管理

- 启动子进程或调试会话作为 "agent"
- 注入 PI\_\* 协议环境变量
- 管理 agent 生命周期

### 10. MAA Assistant Arknights 模式 🄼

自动检测工作区是否为 MAA 项目（检查 `src/MaaCore` 目录），适配：

- Pipeline 后缀切换（`pipeline` ⇔ `tasks`）
- 图片后缀切换（`image` ⇔ `template`）
- 启用 MaaExpression 求值功能

> 注意：MaaAssistantArknights 的 pipeline JSON 语法与 MaaFramework V2 存在差异，插件对此的支持有限。

### 11. 外部工具集成：MaaPipelineEditor

对 MaaFramework Pipeline JSON/JSONC 文件提供可编辑的 MaaPipelineEditor（MPE）嵌入面板：

- 可从文件树、编辑器正文、编辑器标题栏或命令面板打开
- 同一文件复用已有面板，不同文件保持独立的加载、同步和保存状态
- 初次打开和“从 MSE 同步”读取当前 VS Code `TextDocument` 内容，包含尚未落盘的修改
- 若同目录存在分离配置 `.{文件名}.mpe.json`，打开和同步时会一并读取并合并到画布；保存时把 Pipeline 与 sidecar 放进同一次 `WorkspaceEdit` 拆回，避免把 `$__mpe_*` 写进 Pipeline
- sidecar 是画布派生的布局缓存，保存以 MPE 画布为准，不与 Pipeline 对等做冲突确认；删除后再次保存会按分离模式重建
- 只有 sidecar 文件不存在才按集成模式处理。文件存在但打不开、JSON 损坏或字段类型错误时拒绝加载并报错
- 未成功加载完成前禁止保存（含加载进行中和加载失败），避免空画布覆盖 Pipeline；加载成功后恢复保存
- MPE 保存通过 `WorkspaceEdit` 写回原文档，保留 VS Code 的 dirty、undo/redo 和正常保存语义，不直接覆盖磁盘
- MPE 加载后若 Pipeline 源文档被外部编辑，保存时会提示先从 MSE 同步；用户也可以确认使用 MPE 内容强制覆盖
- MPE iframe 使用 v1.4.0 协议；外部链接由宿主校验后交给 VS Code 打开，文档冲突由 MPE 提供同步/强制覆盖选择
- iframe 内的 External 节点跳转由 MSE 使用现有 Pipeline 索引解析；若有多个定义先选择目标，再同时保留目标 JSON 标签和对应 MPE 面板，并在画布加载成功后选中、定位目标节点
- iframe 内不提供 Anchor 跳转，但会把现有 Anchor 索引中的定义文件与节点作为只读上下文传给 MPE 展示
- 嵌入 iframe 会向 MPE 下放剪贴板读写权限，使复制/粘贴走浏览器 Clipboard API 而不是被 Webview Permissions-Policy 拦截
- MPE 地址可通过 `maa.pipelineEditorUrl` 配置，生产地址要求 HTTPS，本机 localhost 开发地址允许 HTTP

该面板是外部编辑器集成，不改变普通 Pipeline 编辑器、命令和菜单的既有行为。

## MAA 日志与存储目录

MaaFramework 原生日志（`maafw.log` / `maa.log`）和识别绘图默认写入当前活动 interface 项目的 `debug/`。`maatools.config.mts` 中的 `cwd`、`maaLogDir` 可覆盖该目录；没有活动项目或项目目录不可写时回退到 `context.storageUri/debug/`（无工作区时再回退到 `context.globalStorageUri/debug/`）。插件自身日志和上传图片副本仍保存在 VS Code storage，Native 模块与跨窗口协调文件仍保存在 global storage。
