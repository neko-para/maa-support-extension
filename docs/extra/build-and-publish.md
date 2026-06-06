# 构建与发布流程

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 构建工具链

| 工具 | 用途 | 使用者 |
|---|---|---|
| `tsdown` | TypeScript 库打包 (ESM) | 大部分包 |
| `vite` | Vue 3 webview 构建 | `@mse/webview` |
| `node scripts/build.mjs` | 构建编排 | 项目根 |

## 构建流程

```
npm run build
  → scripts/build.mjs
    1. buildChain: 按依赖顺序使用 tsdown 构建
       ① simple-parser
       ② maa-tasker
       ③ maa-version-manager, maa-pipeline-manager, maa-locale (并行)
       ④ maa-server, maa-tools, extension (并行)
       ⑤ prettier-plugin-maafw-sort
    2. viteBuild: 构建 webview (Vite 多页面)
```

## 构建配置

每个包的构建配置在 `tsdown.config.mts`：

- 输出格式: ESM (`.mjs` + `.d.mts`)
- Source map: 启用
- 打包策略:
  - 大部分包: 完整打包
  - `@mse/types` 和 `@mse/utils`: 无需构建（由消费方打包器直接处理）
  - `@mse/maa-server`: `@maaxyz/maa-node` 不打包（运行时动态导入）

## 包发布

发布流程由 [.github/workflows/release.yml](../../.github/workflows/release.yml) 驱动。

### 发布 npm 包（`@nekosu/*` 作用域）

**方法**: 手动更新对应包的 `package.json` 中的 `version` 字段，提交到 `main` 分支。CI 检测到新版本号（npm registry 中不存在）后自动执行 `pnpm publish`。

发布顺序由 CI 脚本硬编码（按依赖顺序）：

```
simple-parser → maa-tasker → maa-locale → maa-version-manager → maa-pipeline-manager → maa-tools → prettier-plugin-maafw-sort
```

| 包 | npm 名 |
|---|---|
| `maa-locale` | `@nekosu/maa-locale` |
| `maa-pipeline-manager` | `@nekosu/maa-pipeline-manager` |
| `maa-tasker` | `@nekosu/maa-tasker` |
| `maa-tools` | `@nekosu/maa-tools` |
| `maa-version-manager` | `@nekosu/maa-version-manager` |
| `simple-parser` | `@nekosu/simple-parser` |
| `prettier-plugin-maafw-sort` | `@nekosu/prettier-plugin-maafw-sort` |

> **历史设计问题**: 当更新基础包（如 `maa-tasker`）时，依赖它的包（`maa-pipeline-manager` → `maa-tools`）的版本号需手动更新。发布流程未自动传递版本变更。

### 发布 VSCode 插件

**方法**: 推送格式为 `v*` 的 git tag（正式版）或 `p*` 的 tag（预发布版）。CI 触发后：

1. 从 tag 名提取版本号（去 `v`/`p` 前缀）
2. 写入 `release/package.json` 的 `version`
3. `vsce package` 打包为 `.vsix`
4. `vsce publish` 发布到 VSCode Marketplace

非 tag 推送（分支提交）仅构建和 lint，不发布。

### 内部包（`@mse/*` 作用域）

| 包 | 说明 |
|---|---|
| `types` | 仅内部消费，无 `publishConfig` |
| `utils` | 仅内部消费，无 `publishConfig` |
| `webview` | 随 extension 发布 |
| `maa-server` | 随 extension 发布 |
| `maa-server-proto` | 随 extension 发布 |
| `extension` | 发布到 VSCode Marketplace (`maa-support`) |

## 开发模式

```
npm run dev   # Vite dev server + Run Extension 调试
npm run watch  # build 模式 + Run Extension As Release 调试
```

开发模式下 webview 通过 `forward.html` iframe 代理连接到 Vite dev server，支持 HMR。
