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
  - 添加, 移动, 删除任务
  - 执行任务
- 截取, 裁剪图片 (依赖控制器提供截图能力)

## 提供的vscode命令

使用 Ctrl Shift P (MacOS下 Cmd Shift P) 打开命令面板后搜索使用

- Maa: 打开Maa日志
  - 打开MaaFramework的日志.
- Maa: 打开插件日志
  - 打开插件的日志.
- Maa: 跳转到任务
  - 搜索并跳转到指定任务.
- Maa: 执行任务
  - 基于interface配置创建实例, 然后执行任务.
- Maa: 执行interface
  - 以等价于MaaPiCli的效果执行interface.
- Maa: 生成MSE入口脚本
  - 生成插件专用的Custom脚本.
- Maa: 打开截图工具
  - 打开 进行截图裁剪 的Webview.
- Maa: 展示控制面板
  - 展示并聚焦 控制面板.
- Maa: 选择 MaaFramework 版本
  - 下载并切换插件自身使用的 MaaFramework.
- Maa: 选择下载源
  - 选择下载插件自身使用的 MaaFramework 的镜像源.
