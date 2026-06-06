# 待处理问题

以下问题在文档整理过程中发现，按包分类记录，留待后续处理。

## 整体架构

- [ ] **包划分不合理**: `@mse/utils` 的功能（WebviewProvider、日志）可能更适合归属到 `@mse/extension`。该包被标注为"历史遗留问题"。
- [ ] **包作用域不一致**: 项目存在 `@nekosu/*`（7 个，npm 发布）和 `@mse/*`（6 个，内部使用）两个作用域，缺乏明确的划分规则文档。`@mse/types` 同时被发布到 npm 的 `@nekosu/maa-pipeline-manager` 引用——若 `@mse/*` 不发布，`workspace:*` 依赖在发布时如何处理？
- [ ] **所有依赖列为 devDependencies**: 由于 `tsdown` 打包，所有包的依赖都在 `devDependencies`。对于不打包的包（`@mse/types`、`@mse/utils`），依赖应放在 `dependencies` 还是 `peerDependencies`？是否会导致 `pnpm` hoisting 异常？
- [ ] **缺失测试基础设施**: 整个 monorepo 无测试目录、无测试脚本、无测试框架。需要确定测试策略、优先测试的包以及统一测试框架。
- [ ] **Webview locale 与 @nekosu/maa-locale 代码重复**: Webview 有独立的 locale 系统（`src/utils/locale/`），复制了 `@nekosu/maa-locale` 的 `t()` / `CountBrace` 模式。已确认是历史遗留问题。

## @mse/extension

- [ ] **无依赖注入**: 服务通过模块级变量互相引用，存在循环依赖风险（`interface.ts` 导入 `index.ts` 而 `index.ts` 也导出 `interfaceService`）。服务初始化是否需要显式依赖顺序或 DI 容器？
- [ ] **MaaErrorDelegateImpl 静默吞错误**: `cannotFindTask` 和 `warnCannotFindBaseTask` 方法体被注释掉，某些 pipeline 解析失败被静默忽略。
- [ ] **硬编码路径假设**: `src/MaaCore` 检测 MAA 模式、`config/maa_pi_config.json` 配置路径、`maatools.config.mts` 期望位置均在代码中硬编码。MAA 模式检测的可靠性是否需要改进？
- [ ] **Proxy IPC 无 `then` 处理**: `server.ts` 的 IPC proxy 返回 `undefined` 对 `then` 键，防止被误认为 thenable，是已知的 Proxy 陷阱。
- [ ] **无自动重连**: `RpcManager` 发出 `connectionLost` 但 `ServerService` 仅更新状态栏，不尝试自动重连。
- [ ] **InterfaceHoverProvider 是 no-op**: `provideHover()` 始终返回 `null`，实际实现被注释掉。
- [ ] **Admin 模式仅 Windows**: `switchAdmin()` 在非 Windows 平台直接返回，UAC 提权是 Windows-only。
- [ ] **CommandService 职责混杂**: VSCode 命令注册直接写在 `CommandService` 构造函数中，而非委托给对应的服务。
- [ ] **VSCode 命令命名未统一设计**: 命令命名空间缺乏一致的层级结构，属于历史遗留问题。

## @mse/webview

- [ ] **独立的 locale 系统**: Webview 有自己的 locale 文件（`src/utils/locale/`），复制了 `@nekosu/maa-locale` 的 `t()` / `CountBrace` 模式。两套系统字典不共享。
- [ ] **模拟 `globalThis.maa`**: control panel 的 `state.ts` 使用 Proxy 创建伪造的 `maa` global，始终返回 `'0'`。这是一个 hack 使 pipeline manager 代码在无原生绑定的情况下加载。
- [ ] **全量 State 同步性能问题**: ControlPanel 全量同步 State 时，interface 对象可能过大，导致 Vue 响应式对象重建延迟严重。高频率修改（text input）有临时 debounce 策略。预期改进：将 interface 隔离出主 state；或使用增量同步。但 state 由 utils 模块的固定能力管理，且 interface 从文件全量 parse，难以增量优化。
- [ ] **immer 依赖未实际使用**: `immer` 是为了解决上述性能问题引入的，但收益有限因此未实际使用。`package.json` 中的依赖是历史问题。

## @mse/maa-server-proto

- [ ] **包名与实现不匹配**: `declares.ts` 导出了 `vscode-jsonrpc` 的 `NotificationType` / `RequestType` 实例，因此 `vscode-jsonrpc` 是运行时依赖。但从包名看它应该是纯"协议定义"。是否应将 channel 常量移到独立的传输层包，或接受 `vscode-jsonrpc` 作为合理依赖？

## @nekosu/maa-locale

- [ ] **设计失误——版本语义不清**: 本意是避免插件和 checker 的文案不一致，但直接发布到 npm 导致版本更新不明确——文案的变更难以通过语义化版本传达。

## @nekosu/maa-pipeline-manager

- [ ] **Node.js API 耦合**: 模块深度依赖 Node.js API（`fs`、`path`），导致无法在 browser 环境使用。`IContentLoader` / `IContentWatcher` 等抽象接口未能真正解耦底层实现。这是设计失误。
- [ ] **已知罕见 Bug——文件被删除**: 插件和 checker 同时执行时，有概率错误删除所有图片文件（可能还有其他文件）。代码层面没有任何删除操作，怀疑与 watch 库有关，但理论上不应该发生。
- [ ] **事件驱动导致 checker 使用困难**: 事件驱动架构是历史遗留问题，checker 需要同步的一次性结果而非持续的变更事件流。
- [ ] **自定义解析器局限性**: 自定义 reco/action 解析器无法转发 `pipeline_override` 格式内容，且 AST 产物与标准解析完全隔离。设计失误。
- [ ] **格式切换实验性功能**: `toggleMode()` 会丢失注释，官方推荐使用其他方法迁移。
- [ ] **jsonc-parser 父指针剥离**: `shrinkParent()` 使用 `delete` 操作修改 `readonly` 属性，通过 `deepWriteable` 类型断言绕过。
- [ ] **`buildTree` 丢失位置信息**: 从 jsonc-parser AST 重建纯 JS 对象时丢失了位置/偏移信息。

## @nekosu/maa-tasker

- [ ] **`applyParentToTask` 字符串拼接**: parent 前缀通过原始字符串拼接 (`parent.join('@') + expr`)，代码注释 "这就是 MAA"。可能在边界情况下产生畸形表达式。

## @nekosu/maa-tools

- [ ] **devDependency 作为 fallback**: `@maaxyz/maa-node` 的版本从 `pkg.devDependencies` 读取作为 fallback。是否应将默认版本定义为常量而非从 devDeps 读取？
- [ ] **workerpool 缓存抖动**: test runner 按 `controller-resource` hash key 缓存 worker pool，若组合频繁变化会导致重复创建/销毁。

## @nekosu/maa-version-manager

- [ ] **可变 registry 状态**: `this.registry` 可变，修改后影响所有后续操作。在并发场景下可能导致混乱。
- [ ] **`fs.rename()` 跨设备风险**: `prepare()` 使用 `rename()` 原子移动文件，若 temp 目录和目标目录不在同一文件系统会失败（实际场景中少见）。
- [ ] **pacote 进度限制**: 由于 `pacote` 的技术限制，无法获取下载本身的进度（如百分比），仅能报告阶段切换。

## @nekosu/prettier-plugin-maafw-sort

- [ ] **生产环境 console.log**: `parser.ts` 中有 `console.log('use pipeline mode')` 和 `console.log('use interface mode')` 调试输出，可能污染 Prettier 的 STDERR 输出。

## @nekosu/simple-parser

- [ ] **JS/TS 混合**: 核心运行时是纯 JavaScript（`impl.js`），源自另一个独立的 parser 库。由于 JS 中存在过多 hack，TS 和 JS 有意保持隔离。类型安全通过手写 `.d.ts` 和 TypeScript facade 层的类型体操提供。类型声明与运行时可能漂移。

## 代码风格冲突

经确认，项目中以下差异均为有意设计，非冲突：

- `simple-parser` 的 JS/TS 混合 — 有意隔离，源自独立项目
- `@mse/types`、`@mse/utils` 无构建步骤 — 不对外发布，由 bundler 直接链接
- Webview 独立 locale 系统 — 已确认历史遗留问题，记录在上方 `@nekosu/maa-locale` 条目中

若后续发现更多真正的风格冲突，以项目中最常见的规则为准（`tsdown` 构建、Prettier 配置、ESLint 规则）。
