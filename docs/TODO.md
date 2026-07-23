# 待处理问题

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

以下问题在文档整理过程中发现，按包分类记录，留待后续处理。

## 整体架构

- [ ] **TODO-1** — **包划分不合理**: `@mse/utils` 的功能（WebviewProvider、日志）可能更适合归属到 `@mse/extension`。该包被标注为"历史遗留问题"。
- [x] **TODO-2** — **包作用域设计**: 已确认 `@nekosu/*` 和 `@mse/*` 两个作用域是有意设计——`@mse/*` 仅限内部使用，不对外发布。对外发布的包不得依赖 `@mse/*` 包。已记录到 [common-tech.md](extra/common-tech.md#包作用域)。
- [x] **TODO-3** — **依赖归类**: 已确认 `@mse/*` 包（不构建、不发布）全部列为 `devDependencies` 是有意设计——它们由最终消费者的 bundler 直接链接 TypeScript 源码，无需区分运行时/开发依赖。已记录到 [common-tech.md](extra/common-tech.md#依赖管理)。
- [ ] **TODO-4** — **缺失测试基础设施**: 整个 monorepo 无测试目录、无测试脚本、无测试框架。需要确定测试策略、优先测试的包以及统一测试框架。
- [ ] **TODO-5** — **Webview locale 与 @nekosu/maa-locale 代码重复**: Webview 有独立的 locale 系统（`src/utils/locale/`），复制了 `@nekosu/maa-locale` 的 `t()` / `CountBrace` 模式。已确认是历史遗留问题。
- [ ] **TODO-6** — **基础包版本更新时依赖包需手动升版**: 发布流程未自动传递版本变更。当更新基础包（如 `maa-tasker`）时，依赖它的包（`maa-pipeline-manager` → `maa-tools`）的版本号需手动逐个更新。属于历史设计问题。

## @mse/extension

- [ ] **TODO-7** — **无依赖注入**: 服务通过模块级变量互相引用，存在循环依赖风险（`interface.ts` 导入 `index.ts` 而 `index.ts` 也导出 `interfaceService`）。服务初始化是否需要显式依赖顺序或 DI 容器？
- [ ] **TODO-8** — **MaaErrorDelegateImpl 静默吞错误**: `cannotFindTask` 和 `warnCannotFindBaseTask` 方法体被注释掉，某些 pipeline 解析失败被静默忽略。
- [ ] **TODO-9** — **硬编码路径假设**: `src/MaaCore` 检测 MAA 模式、`config/maa_pi_config.json` 配置路径、`maatools.config.mts` 期望位置均在代码中硬编码。MAA 模式检测的可靠性是否需要改进？
- [x] **TODO-10** — **Proxy IPC 无 `then` 处理**: 已确认 extension 和 maa-server 的 IPC Proxy 均需对 `then` 返回 `undefined`，避免被 `await` / Promise 解析误判为 thenable 并发起错误 RPC。这是必要的 Proxy 兼容处理，已记录到 [ipc-architecture.md](extra/ipc-architecture.md#proxy-模式)。
- [ ] **TODO-11** — **无自动重连**: `RpcManager` 发出 `connectionLost` 但 `ServerService` 仅更新状态栏，不尝试自动重连。
- [ ] **TODO-12** — **InterfaceHoverProvider 是 no-op**: `provideHover()` 始终返回 `null`，实际实现被注释掉。
- [x] **TODO-13** — **Admin 模式仅 Windows**: 已确认为有意的平台边界。Admin 模式用于 Windows UAC/进程完整性等级；macOS 的系统授权及 Linux 的 udev/用户组权限不应通过插件以 root 启动 maa-server 处理。控制面板在非 Windows 平台不暴露该开关。
- [ ] **TODO-14** — **CommandService 职责混杂**: VSCode 命令注册直接写在 `CommandService` 构造函数中，而非委托给对应的服务。
- [ ] **TODO-15** — **VSCode 命令命名未统一设计**: 命令命名空间缺乏一致的层级结构，属于历史遗留问题。

## @mse/webview

- [ ] **TODO-16** — **独立的 locale 系统**: Webview 有自己的 locale 文件（`src/utils/locale/`），复制了 `@nekosu/maa-locale` 的 `t()` / `CountBrace` 模式。两套系统字典不共享。
- [ ] **TODO-17** — **模拟 `globalThis.maa`**: control panel 的 `state.ts` 使用 Proxy 创建伪造的 `maa` global，始终返回 `'0'`。这是一个 hack 使 pipeline manager 代码在无原生绑定的情况下加载。
- [ ] **TODO-18** — **全量 State 同步性能问题**: ControlPanel 全量同步 State 时，interface 对象可能过大，导致 Vue 响应式对象重建延迟严重。高频率修改（text input）有临时 debounce 策略。预期改进：将 interface 隔离出主 state；或使用增量同步。但 state 由 utils 模块的固定能力管理，且 interface 从文件全量 parse，难以增量优化。
- [x] **TODO-19** — **immer 依赖未实际使用**: 已确认代码中没有 `immer` 引用，现已从 Webview 依赖及技术文档中移除。

## @mse/maa-server-proto

- [x] **TODO-20** — **包名与实现不匹配**: `declares.ts` 导出了 `vscode-jsonrpc` 的 `NotificationType` / `RequestType` 实例。已确认接受 `vscode-jsonrpc` 作为协议定义的合理依赖——RPC channel 常量需要这些实例确保两端消息名称一致，拆分到独立传输层包收益有限。

## @nekosu/maa-locale

- [ ] **TODO-21** — **设计失误——版本语义不清**: 本意是避免插件和 checker 的文案不一致，但直接发布到 npm 导致版本更新不明确——文案的变更难以通过语义化版本传达。

## @nekosu/maa-pipeline-manager

- [ ] **TODO-22** — **Node.js API 耦合**: 模块深度依赖 Node.js API（`fs`、`path`），导致无法在 browser 环境使用。`IContentLoader` / `IContentWatcher` 等抽象接口未能真正解耦底层实现。这是设计失误。
- [x] **TODO-23** — **已知罕见 Bug——文件被删除**: checker 执行时，有概率错误删除所有图片文件。代码层面没有任何删除操作，但理论上不应该发生。实际情况是将日志目录设置为工作区根目录后，MaaFramework 会递归清理上次更新时间在7天以上的 png 文件。
- [ ] **TODO-24** — **事件驱动导致 checker 使用困难**: 事件驱动架构是历史遗留问题，checker 需要同步的一次性结果而非持续的变更事件流。
- [ ] **TODO-25** — **自定义解析器局限性**: 自定义 reco/action 解析器无法转发 `pipeline_override` 格式内容，且 AST 产物与标准解析完全隔离。设计失误。
- [ ] **TODO-26** — **格式切换实验性功能**: `toggleMode()` 会丢失注释，官方推荐使用其他方法迁移。
- [x] **TODO-27** — **jsonc-parser 父指针剥离**: `shrinkParent()` 使用 `delete` 操作修改 `readonly` 属性。已确认是预期行为——AST 在多处缓存，剥离 parent 指针优化内存占用。代码不依赖 parent 指针，`deepWriteable` 断言是必要的实现手段。
- [x] **TODO-28** — **`buildTree` 丢失位置信息**: 从 jsonc-parser AST 重建纯 JS 对象时丢失了位置/偏移信息。已确认是有意设计——`buildTree` 用于求值/合并/存储上下文，生成轻量 plain object；诊断走原始 AST Node（保留位置）。两者分工明确。

## @nekosu/maa-tasker

- [x] **TODO-29** — **`applyParentToTask` 字符串拼接**: parent 前缀通过原始字符串拼接。已确认是模拟 MAA 内核行为——代码注释 "这就是 MAA" 即说明这是有意还原 MAA 的解析逻辑。

## @nekosu/maa-tools

- [x] **TODO-30** — **devDependency 作为 fallback**: 已确认从 `pkg.devDependencies['@maaxyz/maa-node']` 读取默认版本是有意设计，使运行时下载版本与编译/类型检查版本保持单一来源，避免额外常量发生漂移。
- [ ] **TODO-31** — **workerpool 缓存抖动**: test runner 按 `controller-resource` hash key 缓存 worker pool，若组合频繁变化会导致重复创建/销毁。

## @nekosu/maa-version-manager

- [ ] **TODO-32** — **可变 registry 状态**: `this.registry` 可变，修改后影响所有后续操作。在并发场景下可能导致混乱。
- [ ] **TODO-33** — **`fs.rename()` 跨设备风险**: `prepare()` 使用 `rename()` 原子移动文件，若 temp 目录和目标目录不在同一文件系统会失败（实际场景中少见）。
- [x] **TODO-34** — **pacote 进度限制**: 已确认这是当前依赖的能力边界。`prepare()` 的 `progress` API 明确提供阶段事件而非下载百分比，限制已记录到 maa-version-manager 产品文档。

## @nekosu/prettier-plugin-maafw-sort

- [x] **TODO-35** — **生产环境 console.log**: 已移除 `parser.ts` 中 Pipeline/Interface 模式匹配时的调试输出，Prettier 格式化不再产生这两条额外控制台信息。

## @nekosu/simple-parser

- [x] **TODO-36** — **JS/TS 混合**: 核心运行时是纯 JavaScript（`impl.js`），源自另一个独立的 parser 库。由于 JS 中存在过多 hack，TS 和 JS 有意保持隔离。类型安全通过手写 `.d.ts` 和 TypeScript facade 层的类型体操提供。类型声明与运行时可能漂移。

## 代码风格冲突

经确认，项目中以下差异均为有意设计，非冲突：

- `simple-parser` 的 JS/TS 混合 — 有意隔离，源自独立项目
- `@mse/types`、`@mse/utils` 无构建步骤 — 不对外发布，由 bundler 直接链接
- Webview 独立 locale 系统 — 已确认历史遗留问题，记录在上方 `@nekosu/maa-locale` 条目中

若后续发现更多真正的风格冲突，以项目中最常见的规则为准（`tsdown` 构建、Prettier 配置、ESLint 规则）。
