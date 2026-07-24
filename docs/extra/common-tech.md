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

例外：

- `@mse/types`、`@mse/utils`：不构建，由消费方 bundler 直接链接 TypeScript 源码（不对外发布）
- `@mse/webview`：使用 Vite 构建（浏览器环境）

## 依赖管理

- **workspace 依赖**: 使用 `workspace:*` 协议
- **`@nekosu/*`（发布包）**: 运行时依赖放在 `dependencies`，构建工具和类型放在 `devDependencies`
- **`@mse/*`（内部包）**: 全部列为 `devDependencies`。这些包不构建也不发布，由最终消费者的 bundler 直接链接 TypeScript 源码，无需区分运行时/开发依赖

### 包作用域

| 作用域      | 用途     | 发布       |
| ----------- | -------- | ---------- |
| `@nekosu/*` | 对外发布 | npm        |
| `@mse/*`    | 内部专用 | 不对外发布 |

**约束**: 对外发布到 npm 的 `@nekosu/*` 包不得依赖 `@mse/*` 包。

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
