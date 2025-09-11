# Maa Support

## 针对 MaaFramework/MaaAssistantArknights 项目, 提供下列功能:

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

## For MaaFramework/MaaAssistantArknights project, providing following features:

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
