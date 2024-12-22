# Maa Support

## 针对项目MaaFramework, 提供下列功能:

> 控制面板 通常在 大纲/时间线 的下面, 可以使用 Maa: 展示控制面板 命令将其聚焦
> 
> 功能均基于 `interface.json` 配置, 该文件修改后需要在 控制面板 中点击 刷新 重新载入

* 语义化资源分析
  * 查询任务定义
  * 查询任务引用
  * ~~重命名任务~~ 已移除, 建议直接全局搜索替换
  * 补全任务
  * 补全图像
  * 校验任务
  * 校验图像路径
  * 多路径资源支持
* MaaPiCli功能复刻
  * 选择控制器
  * 选择资源
  * 添加, 移动, 删除任务
  * 执行任务
* 截取, 裁剪图片

---

## 提供的vscode命令

使用 Ctrl Shift P (MacOS下 Cmd Shift P) 打开命令面板后搜索使用

* Maa: 打开Maa日志
  * 打开MaaFramework的日志.
* Maa: 打开插件日志
  * 打开插件的日志.
* Maa: 跳转到任务
  * 搜索并跳转到指定任务.
* Maa: 执行任务
  * 基于interface配置创建实例, 然后执行任务.
* Maa: 执行interface
  * 以等价于MaaPiCli的效果执行interface.
* Maa: 生成MSE入口脚本
  * 生成插件专用的Custom脚本.
* Maa: 展示控制面板
  * 展示并聚焦 控制面板.
* Maa: 打开截图工具
  * 打开 进行截图裁剪 的Webview.
