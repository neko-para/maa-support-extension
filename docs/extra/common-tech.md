# 通用技术约定

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

本 monorepo 中所有包共享以下技术约定。具体构建流程见 [build-and-publish.md](build-and-publish.md)。

## 模块系统

- **模块格式**: ES2022, `"type": "module"`
- **TypeScript**: `verbatimModuleSyntax`, `moduleResolution: "bundler"`
- **基础配置**: `@tsconfig/node24`

## 构建

- **工具**: [tsdown](https://tsdown.dev/) — 基于 [Rolldown](https://rolldown.rs/)（Rust 打包器）和 [Oxc](https://oxc.rs/)（Rust TypeScript 解析器）
- **输出**: ESM（`.mjs` + `.d.mts`），含 source map
- **配置**: 每个包的 `tsdown.config.mts`
- **不打包例外**: `@maaxyz/maa-node` 始终排除（运行时动态导入）

例外：`@mse/webview` 使用 Vite 构建（浏览器环境）。

## 测试

- **根命令**: `pnpm test` 先执行仓库级脚本测试，再递归执行所有声明 `test` 脚本的 workspace 包
- **Node.js 包**: 优先使用 Node.js 24 内置的 `node:test`，测试放在包内 `test/**/*.test.ts`
- **类型检查**: 测试文件应纳入对应包的 `tsconfig.json`
- **隔离性**: 文件系统测试使用系统临时目录，不读写用户的真实缓存；网络和原生绑定边界通过可覆盖方法或适配器隔离

首批测试覆盖 `@nekosu/maa-version-manager` 的事务化安装、失败回滚和文件锁释放。VSCode Extension 和 Webview 等需要特殊运行时的包，可保留包级测试适配，但统一由根 `pnpm test` 编排。

## 依赖管理

- **workspace 依赖**: 使用 `workspace:*` 协议
- **`@nekosu/*`（发布包）**: 运行时依赖放在 `dependencies`，构建工具和类型放在 `devDependencies`
- **`@mse/*`（内部包）**: 不发布到 npm，依赖全部列为 `devDependencies`，由 extension 或 Vite 的最终构建产物打包

### 包作用域

| 作用域      | 用途     | 发布       |
| ----------- | -------- | ---------- |
| `@nekosu/*` | 对外发布 | npm        |
| `@mse/*`    | 内部专用 | 不对外发布 |

**约束**: 对外发布到 npm 的 @nekosu/_ 包不得依赖 @mse/_ 包。@mse/types、@mse/maa-server-proto、@mse/maa-server 已迁移至 @nekosu/\*（@nekosu/maa-types、@nekosu/maa-server-proto、@nekosu/maa-server）并发布，供跨编辑器核心层复用。

## 包结构约定

```
pkgs/{pkg}/
├── src/
│   └── index.ts          # 公共 API 入口
├── tsdown.config.mts     # tsdown 构建配置
├── package.json          # `"main"` 指向 `src/index.ts` 或 `dist/index.mjs`
└── tsconfig.json
```

## 零依赖包

部分底层包有意保持零运行时依赖（`simple-parser`、`maa-locale`），仅 `devDependencies` 中含 TypeScript 和 Node 类型。这是为了最小化传递依赖。
