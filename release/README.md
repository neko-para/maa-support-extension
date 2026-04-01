# Maa Support

## 针对 MaaFramework/MaaAssistantArknights 项目, 提供下列功能

> 控制面板在左侧类似设置图标的面板中
>
> 功能均基于 `interface.json` 配置
>
> 插件根据打开文件夹的根目录是否有 `src/MaaCore` 文件夹来判定是否是 MaaAssistantArknights 项目

- 语义化资源分析
  - 查询任务定义
  - 查询任务引用
  - 补全任务
  - 补全图像路径
  - 校验任务
  - 校验图像路径
  - 多路径资源支持
- MaaPiCli功能 (仅MaaFramework项目)
  - 选择控制器
  - 选择资源
  - 添加并管理任务
  - 执行任务
- 截取图片 (依赖控制器提供截图能力)
- 裁剪图片

## For MaaFramework/MaaAssistantArknights project, providing following features

> Control Panel stays at left, with an icon similar to settings.
>
> All features are based on `interface.json`
>
> Extension will check if `src/MaaCore` exists, to decide if it is MaaAssistantArknights project.

- Semantic resource analyze
  - Query task definition
  - Query task reference
  - Task autocompletion
  - Image path autocompletion
  - Task diagnostic
  - Image path diagnostic
  - Multiple paths of resource support
- Ability of MaaPiCli (MaaFramework project only)
  - Select controller
  - Select resource
  - Add and manipulate tasks
  - Run tasks
- Take screenshots (Relying on controllers for screenshot ability)
- Crop images

## 提供的vscode命令

使用 Ctrl Shift P (MacOS下 Command Shift P) 打开命令面板后搜索使用

- Maa: 打开Maa日志
  - 打开MaaFramework的日志.
- Maa: 打开插件日志
  - 打开插件的日志.
- Maa: 跳转到任务
  - 搜索并跳转到指定任务.
- Maa: 执行任务
  - 基于interface配置创建实例, 然后执行指定任务.
- Maa: 执行interface
  - 基于interface配置创建实例, 然后执行所有配置任务.
- Maa: 打开截图工具
  - 打开 进行截图裁剪 的 Webview.
- Maa: 展示控制面板
  - 展示并聚焦 控制面板.
- Maa: 选择 MaaFramework 版本
  - 下载并切换插件自身使用的 MaaFramework.
- Maa: 选择下载源
  - 选择下载插件自身使用的 MaaFramework 的镜像源.

## 配置文件 (maatools.config.mts)

在项目根目录创建 `maatools.config.mts` 配置文件来自定义行为:

```typescript
import type { FullConfig } from '@nekosu/maa-tools'

const config: FullConfig = {
  cwd: import.meta.dirname,
  repo: 'https://github.com/MaaAssistantArknights/MaaAssistantArknights',
  locale: 'zh-cn',
  maaVersion: 'v5.2.0',
  interfacePath: './interface.json',
  parser: {
    // 解析器配置
  },
  check: {
    override: {
      // 诊断类型覆盖
    }
  }
}

export default config
```

### 配置项说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `cwd` | `string` | 工作目录 |
| `mode` | `'stdio' \| 'github' \| 'json'` | 运行模式 |
| `repo` | `string` | MAA 仓库地址 |
| `locale` | `'zh-cn' \| 'en'` | 语言设置 |
| `maaVersion` | `string` | MAA 版本 |
| `maaCache` | `string` | MAA 缓存路径 |
| `maaMirror` | `string` | NPM 镜像源 |
| `maaStdoutLevel` | `'Off' \| 'Fatal' \| 'Error' \| 'Warn' \| 'Info' \| 'Debug' \| 'Trace' \| 'All'` | 日志级别 |
| `maaLogDir` | `string` | 日志目录 |
| `interfacePath` | `string` | 接口配置文件路径 |
| `parser` | `ParserConfig` | 解析器配置 |
| `check` | `CheckConfig` | 检查配置 |
| `test` | `TestConfig` | 测试配置 |
| `vscode` | `VscodeConfig` | VSCode 配置 |

> VSCode 扩展会自动检测并加载配置文件, 支持热重载.

## Provided vscode commands

Use Ctrl Shift P (Command Shift P for MacOS) to open command panel and search

- Maa: open maa log
  - Open the log of MaaFramework.
- Maa: open extension log
  - Open the log of extension.
- Maa: goto task
  - Search and navigate to certain task.
- Maa: launch task
  - Create instance based on interface, and launch the specified task.
- Maa: launch interface
  - Create instance based on interface, and launch all configured tasks.
- Maa: open crop tool
  - Open webview for taking screenshots and cropping images.
- Maa: reveal control panel
  - Reveal and focus control panel.
- Maa: select MaaFramework version
  - Download and change the version of MaaFramework used by extension.
- Maa: select fetch registry
  - Select the mirrors to download MaaFramework used by extension.

## Configuration File (maatools.config.mts)

Create `maatools.config.mts` in your project root to customize behavior:

```typescript
import type { FullConfig } from '@nekosu/maa-tools'

const config: FullConfig = {
  cwd: import.meta.dirname,
  repo: 'https://github.com/MaaAssistantArknights/MaaAssistantArknights',
  locale: 'zh-cn',
  maaVersion: 'v5.2.0',
  interfacePath: './interface.json',
  parser: {
    // parser config
  },
  check: {
    override: {
      // diagnostic type override
    }
  }
}

export default config
```

### Config Options

| Field | Type | Description |
|-------|------|-------------|
| `cwd` | `string` | Working directory |
| `mode` | `'stdio' \| 'github' \| 'json'` | Run mode |
| `repo` | `string` | MAA repository URL |
| `locale` | `'zh-cn' \| 'en'` | Language setting |
| `maaVersion` | `string` | MAA version |
| `maaCache` | `string` | MAA cache path |
| `maaMirror` | `string` | NPM mirror |
| `maaStdoutLevel` | `'Off' \| 'Fatal' \| 'Error' \| 'Warn' \| 'Info' \| 'Debug' \| 'Trace' \| 'All'` | Log level |
| `maaLogDir` | `string` | Log directory |
| `interfacePath` | `string` | Interface config path |
| `parser` | `ParserConfig` | Parser config |
| `check` | `CheckConfig` | Check config |
| `test` | `TestConfig` | Test config |
| `vscode` | `VscodeConfig` | VSCode config |

> VSCode extension will automatically detect and load the config file with hot-reload support.
