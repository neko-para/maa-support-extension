# 待处理问题

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

以下问题在文档整理过程中发现，按包分类记录，留待后续处理。

## 整体架构

- [ ] **TODO-1** — **包划分不合理**: `@mse/utils` 的功能（WebviewProvider、日志）可能更适合归属到 `@mse/extension`。该包被标注为"历史遗留问题"。
- [x] **TODO-2** — **包作用域设计**: `@nekosu/*`（对外发布）和 `@mse/*`（内部专用）两个作用域为有意设计。`@mse/types`、`@mse/maa-server-proto`、`@mse/maa-server` 已迁移至 `@nekosu/*`（`@nekosu/maa-types`、`@nekosu/maa-server-proto`、`@nekosu/maa-server`）并发布，供跨编辑器核心层复用。剩余 `@mse/*` 包（`utils`、`webview`、`extension`）仍仅限内部使用。已记录到 [common-tech.md](extra/common-tech.md#包作用域)。
- [x] **TODO-3** — **依赖归类**: `@mse/*` 内部包（不构建、不发布）全部列为 `devDependencies` 是有意设计——由最终消费者的 bundler 直接链接 TypeScript 源码，无需区分运行时/开发依赖。已迁移至 `@nekosu/*` 的包（`maa-types`、`maa-server-proto`、`maa-server`）改按发布包规则归类：运行时依赖放 `dependencies`，`@maaxyz/maa-node` 放 `devDependencies`。已记录到 [common-tech.md](extra/common-tech.md#依赖管理)。
- [x] **TODO-4** — **缺失测试基础设施**: 已建立根 `pnpm test` 递归编排和 CI 测试步骤。Node.js 包优先使用 Node.js 24 内置 `node:test`，测试位于包内 `test/**/*.test.ts` 并纳入类型检查；需要特殊运行时的包保留包级适配。首批测试覆盖 `maa-version-manager` 安装事务。约定已记录到 [common-tech.md](extra/common-tech.md#测试)。
- [ ] **TODO-5** — **Webview locale 与 @nekosu/maa-locale 代码重复**: Webview 有独立的 locale 系统（`src/utils/locale/`），复制了 `@nekosu/maa-locale` 的 `t()` / `CountBrace` 模式。已确认是历史遗留问题。
- [x] **TODO-6** — **基础包版本更新时依赖包需手动升版**: 已新增 `pnpm version-packages`。显式包按 `major`/`minor`/`patch` 或精确稳定版本升版，所有通过运行时 `workspace:*` 依赖它的直接和传递公开包自动升 patch，并按依赖拓扑顺序输出。默认只预览，`--write` 才修改所有相关 manifest。使用方式已记录到 [build-and-publish.md](extra/build-and-publish.md#发布-npm-包nekosu-作用域)。

## @mse/extension

- [ ] **TODO-7** — **无依赖注入**: 服务通过模块级变量互相引用，存在循环依赖风险（`interface.ts` 导入 `index.ts` 而 `index.ts` 也导出 `interfaceService`）。服务初始化是否需要显式依赖顺序或 DI 容器？
- [x] **TODO-8** — **MaaErrorDelegateImpl 静默吞错误**: 已确认这两个回调属于用户手动执行 MaaExpression 求值，而非后台 pipeline 解析诊断；回调也不含可用于编辑器诊断的文件位置。现在会在单次求值中收集并去重，求值失败时提示具体的阻断任务。`warnCannotFindBaseTask` 不直接提示用户：在 MaaAssistantArknights 官方服资源的 3252 个任务中，有 1463 个合法任务名称包含 `@` 但不存在对应后缀基任务；该回调仅用于从失败详情中排除这种非阻断 miss，避免大量误报。
- [x] **TODO-9** — **硬编码路径假设**: 已确认三处路径均为有意约定，无需配置化：`src/MaaCore` 是可靠的 MaaAssistantArknights 项目标识，`config/maa_pi_config.json` 是插件项目配置的固定路径，工作区根目录的 `maatools.config.mts` 是 maa-tools 的约定配置入口。约定已记录到 extension 技术文档。
- [x] **TODO-10** — **Proxy IPC 无 `then` 处理**: 已确认 extension 和 maa-server 的 IPC Proxy 均需对 `then` 返回 `undefined`，避免被 `await` / Promise 解析误判为 thenable 并发起错误 RPC。这是必要的 Proxy 兼容处理，已记录到 [ipc-architecture.md](extra/ipc-architecture.md#proxy-模式)。
- [x] **TODO-11** — **无自动重连**: 已确认当前采用按需重连：`connectionLost` 清空连接并更新状态，但不立即重启；下一次功能调用进入 `ServerService.ensureServer()` 时会重新启动 maa-server 并建立连接。断线时子进程内的 Maa 实例状态已经丢失，立即重连也无法恢复原任务，因此无需增加后台重试。连接生命周期已记录到 extension 技术文档。
- [x] **TODO-12** — **InterfaceHoverProvider 是 no-op**: 已恢复 interface 本地化引用的悬停内容。历史实现读取 `InterfaceInfo.refs`；locale 解析重构将这些引用迁移到 `InterfaceInfo.layer.extraRefs` 时，旧逻辑被注释但 Provider 仍继续注册。现在按当前索引结构查找 `task.locale`，并复用各语言 resolved value 表格。
- [x] **TODO-13** — **Admin 模式仅 Windows**: 已确认为有意的平台边界。Admin 模式用于 Windows UAC/进程完整性等级；macOS 的系统授权及 Linux 的 udev/用户组权限不应通过插件以 root 启动 maa-server 处理。控制面板在非 Windows 平台不暴露该开关。
- [x] **TODO-14** — **CommandService 职责混杂**: 已确认当前分工是有意的应用层边界：仅由单一领域拥有的命令由对应服务注册（如 NativeService、StatusBarService、PipelineCodeActionsProvider），需要协调多个服务并处理 VS Code UI 的命令集中在 CommandService。核心操作已下沉到 InterfaceService、LaunchService、ServerService 等；继续按命令拆分会分散 UI 编排并加重模块级循环依赖，因此不做机械重构。命令归属约定已记录到 extension 技术文档。
- [ ] **TODO-15** — **VSCode 命令命名未统一设计**: 命令命名空间缺乏一致的层级结构，属于历史遗留问题。

## @mse/webview

- [ ] **TODO-16** — **独立的 locale 系统**: Webview 有自己的 locale 文件（`src/utils/locale/`），复制了 `@nekosu/maa-locale` 的 `t()` / `CountBrace` 模式。两套系统字典不共享。
- [ ] **TODO-17** — **模拟 `globalThis.maa`**: control panel 的 `state.ts` 使用 Proxy 创建伪造的 `maa` global，始终返回 `'0'`。这是一个 hack 使 pipeline manager 代码在无原生绑定的情况下加载。
- [ ] **TODO-18** — **全量 State 同步性能问题**: ControlPanel 全量同步 State 时，interface 对象可能过大，导致 Vue 响应式对象重建延迟严重。高频率修改（text input）有临时 debounce 策略。预期改进：将 interface 隔离出主 state；或使用增量同步。但 state 由 utils 模块的固定能力管理，且 interface 从文件全量 parse，难以增量优化。
- [x] **TODO-19** — **immer 依赖未实际使用**: 已确认代码中没有 `immer` 引用，现已从 Webview 依赖及技术文档中移除。

## @nekosu/maa-server-proto

- [x] **TODO-20** — **包名与实现不匹配**: `declares.ts` 导出了 `vscode-jsonrpc` 的 `NotificationType` / `RequestType` 实例。已确认接受 `vscode-jsonrpc` 作为协议定义的合理依赖——RPC channel 常量需要这些实例确保两端消息名称一致，拆分到独立传输层包收益有限。

## @nekosu/maa-locale

- [ ] **TODO-21** — **设计失误——版本语义不清**: 本意是避免插件和 checker 的文案不一致，但直接发布到 npm 导致版本更新不明确——文案的变更难以通过语义化版本传达。

## @nekosu/maa-pipeline-manager

- [ ] **TODO-22** — **Node.js API 耦合**: 模块深度依赖 Node.js API（`fs`、`path`），导致无法在 browser 环境使用。`IContentLoader` / `IContentWatcher` 等抽象接口未能真正解耦底层实现。这是设计失误。
- [x] **TODO-23** — **已知罕见 Bug——文件被删除**: checker 执行时，有概率错误删除所有图片文件。代码层面没有任何删除操作，但理论上不应该发生。实际情况是将日志目录设置为工作区根目录后，MaaFramework 会递归清理上次更新时间在7天以上的 png 文件。
- [x] **TODO-24** — **事件驱动导致 checker 使用困难**: checker 目前只复用 chokidar 的初始扫描与 `ready` 边界，诊断完成后会立即关闭 watcher，并不提供文件变化后的持续重检。已实作一次性 snapshot 扫描并在 M9A、MaaEnd 上对比：输出逐字一致，但最佳 snapshot 中位耗时仍由 4.874/6.298 秒增至 5.130/6.816 秒。因此撤销 snapshot 实现，保留 chokidar 的成熟递归扫描，结论记录于 `maa-pipeline-manager` 和 `maa-tools` 技术文档。
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
- [x] **TODO-33** — **`fs.rename()` 跨设备风险**: 安装 staging 已移到 `install/` 目录内，最终 `rename()` 始终在同一文件系统中完成。同时修复了异常时不释放锁、遗留半成品及下次误判已安装的问题；现在会验证两个包与时间戳、失败回滚并在 `finally` 中释放锁。
- [x] **TODO-34** — **pacote 进度限制**: 已确认这是当前依赖的能力边界。`prepare()` 的 `progress` API 明确提供阶段事件而非下载百分比，限制已记录到 maa-version-manager 产品文档。

## @nekosu/prettier-plugin-maafw-sort

- [x] **TODO-35** — **生产环境 console.log**: 已移除 `parser.ts` 中 Pipeline/Interface 模式匹配时的调试输出，Prettier 格式化不再产生这两条额外控制台信息。

## @nekosu/simple-parser

- [x] **TODO-36** — **JS/TS 混合**: 核心运行时是纯 JavaScript（`impl.js`），源自另一个独立的 parser 库。由于 JS 中存在过多 hack，TS 和 JS 有意保持隔离。类型安全通过手写 `.d.ts` 和 TypeScript facade 层的类型体操提供。类型声明与运行时可能漂移。

## 代码风格冲突

经确认，项目中以下差异均为有意设计，非冲突：

- `simple-parser` 的 JS/TS 混合 — 有意隔离，源自独立项目
- `@mse/utils` 无构建步骤 — 不对外发布，由 bundler 直接链接（`@mse/types` 已迁移至 `@nekosu/maa-types` 并启用构建）
- Webview 独立 locale 系统 — 已确认历史遗留问题，记录在上方 `@nekosu/maa-locale` 条目中

若后续发现更多真正的风格冲突，以项目中最常见的规则为准（`tsdown` 构建、Prettier 配置、ESLint 规则）。
