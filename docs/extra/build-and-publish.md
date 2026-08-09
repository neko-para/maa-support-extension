# 构建与发布流程

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 构建工具链

| 工具                     | 用途                    | 使用者         |
| ------------------------ | ----------------------- | -------------- |
| `tsdown`                 | TypeScript 库打包 (ESM) | 大部分包       |
| `vite`                   | Vue 3 webview 构建      | `@mse/webview` |
| `node scripts/build.mjs` | 构建编排                | 项目根         |

## 构建流程

```
npm run build
  → scripts/build.mjs
    1. buildChain: 按依赖顺序使用 tsdown 构建
       ① simple-parser
       ② maa-tasker
       ③ maa-version-manager, maa-pipeline-manager, maa-locale (并行)
       ④ types, maa-server-proto (并行)
       ⑤ maa-server, maa-tools, extension, utils (并行)
       ⑥ prettier-plugin-maafw-sort
    2. viteBuild: 构建 webview (Vite 多页面)
```

## 构建配置

每个包的构建配置在 `tsdown.config.mts`：

- 输出格式: ESM (`.mjs` + `.d.mts`)
- Source map: 启用
- 打包策略:
  - 大部分包: 完整打包
  - `@mse/utils`: 无需构建（由消费方打包器直接处理）
  - `@nekosu/maa-server`: `@maaxyz/maa-node` 不打包（运行时动态导入）；tsdown 输出到 `dist/`，`scripts/build.mjs` 再拷贝到 `release/server/`

### MaaFramework 基线版本

`scripts/.maaver` 记录插件预装的 MaaFramework 版本。更新时必须同步 7 个相关 workspace 包中 `@maaxyz/maa-node` 的精确 devDependency 版本及 `pnpm-lock.yaml`，确保预装运行时、动态下载 fallback 和编译类型保持一致。`scripts/updateMaa.sh` 用于执行这项同步。

## 验证流程

- `pnpm lint` 执行所有包的类型检查和全局 ESLint
- `pnpm test` 递归执行所有提供 `test` 脚本的包
- Release CI 在打包和发布前同时运行 lint 和测试

## 包发布

发布流程由 [.github/workflows/release.yml](../../.github/workflows/release.yml) 驱动。

### 发布 npm 包（`@nekosu/*` 作用域）

**方法**: 使用根目录的联动升版脚本，再将所有变更的 `package.json` 一起提交到 `main` 分支。CI 检测到新版本号（npm registry 中不存在）后自动执行 `pnpm publish`。

```bash
# 默认只预览，不修改文件
pnpm version-packages maa-tasker=minor

# 应用计划
pnpm version-packages --write maa-tasker=minor

# 也可指定完整包名和精确新版本
pnpm version-packages --write @nekosu/maa-version-manager=1.1.0
```

脚本接受 `major`、`minor`、`patch` 或高于当前版本的稳定 SemVer。显式指定的包按请求升版；通过 `dependencies` 使用 `workspace:*` 依赖它的所有直接和传递公开包自动升 patch。多个基础包可在同一次命令中指定，依赖方只升版一次。

`pnpm publish` 会把发布包中的 `workspace:*` 转换为当前 workspace 包的精确版本，因此依赖方必须以新版本重新发布。联动脚本只跟踪对外发布包的运行时 `dependencies`；`devDependencies` 和不发布的 `@mse/*` 包不触发版本传播。

`@nekosu/maa-locale` 的纯翻译修订升 patch，新增 key 或语言升 minor，删除/重命名 key、删除语言或改变占位参数契约升 major。具体规则见 [Maa Locale 产品定义](../maa-locale/models/README.md#版本语义)。例如 `pnpm version-packages maa-locale=patch` 会同时安排所有精确依赖旧版本 locale 的公开运行时消费者重新发布。自动传播的 patch 是最低级别；若依赖方的公开 API 也发生不兼容变化，需在同一命令中显式指定该包的 major/minor 升版。

发布顺序由 CI 脚本硬编码（按依赖顺序）：

```
simple-parser → maa-tasker → maa-locale → maa-version-manager → maa-pipeline-manager → maa-types → maa-server-proto → maa-server → maa-tools → prettier-plugin-maafw-sort
```

| 包                           | npm 名                               |
| ---------------------------- | ------------------------------------ |
| `simple-parser`              | `@nekosu/simple-parser`              |
| `maa-tasker`                 | `@nekosu/maa-tasker`                 |
| `maa-locale`                 | `@nekosu/maa-locale`                 |
| `maa-version-manager`        | `@nekosu/maa-version-manager`        |
| `maa-pipeline-manager`       | `@nekosu/maa-pipeline-manager`       |
| `types`                      | `@nekosu/maa-types`                  |
| `maa-server-proto`           | `@nekosu/maa-server-proto`           |
| `maa-server`                 | `@nekosu/maa-server`                 |
| `maa-tools`                  | `@nekosu/maa-tools`                  |
| `prettier-plugin-maafw-sort` | `@nekosu/prettier-plugin-maafw-sort` |

联动升版计划按依赖拓扑顺序输出，与 CI 的发布顺序一致；运行 `--write` 后应检查计划中的所有包都在同一次提交中。

### 发布 VSCode 插件

**构建产物目录**: `release/` — 插件打包根目录。`package.json`、`README.md`、`images/`、`out/`（编译后的扩展代码）、`webview/`（Vite 构建产物）、`server/`（maa-server）等均位于此目录。修改插件的 `contributes`（命令、配置项、视图等）或 `engines` 等清单字段时，应修改 `release/package.json`，而非源码 `pkgs/extension/package.json`。

**发布目标**: VSCode Marketplace 和 Open VSX，扩展标识均为 `nekosu.maa-support`。两个市场复用同一个 `.vsix` 构建产物，并通过相互独立的 CI job 发布，单个市场发布失败不会阻止另一个市场的发布 job 启动。

**CI secrets**:

| Secret       | 用途                              |
| ------------ | --------------------------------- |
| `VSCE_TOKEN` | 发布到 VSCode Marketplace         |
| `OVSX_PAT`   | 发布到 Open VSX 的 Personal Token |

**方法**: 推送格式为 `v*` 的 git tag（正式版）或 `p*` 的 tag（预发布版）。CI 触发后：

1. 从 tag 名提取版本号（去 `v`/`p` 前缀）
2. 写入 `release/package.json` 的 `version`
3. `vsce package` 打包为 `.vsix`；`v*` tag 生成正式版，`p*` tag 通过 `--pre-release` 写入预发布标记
4. 下载同一构建产物，并行执行：
   - `vsce publish` 发布到 VSCode Marketplace
   - `ovsx publish` 发布到 Open VSX；Open VSX 根据 `.vsix` 中的标记将版本识别为正式版或预发布版，上传时无需再次传入 `--pre-release`

非 tag 推送（分支提交）仅构建、lint 和测试，不发布。

### 内部包（`@mse/*` 作用域）

| 包          | 说明                                                         |
| ----------- | ------------------------------------------------------------ |
| `utils`     | 仅内部消费，无 `publishConfig`                               |
| `webview`   | 随 extension 发布                                            |
| `extension` | 发布到 VSCode Marketplace 和 Open VSX (`nekosu.maa-support`) |

## 开发模式

```
npm run dev   # Vite dev server + Run Extension 调试
npm run watch  # build 模式 + Run Extension As Release 调试
```

开发模式下 webview 通过 `forward.html` iframe 代理连接到 Vite dev server，支持 HMR。
