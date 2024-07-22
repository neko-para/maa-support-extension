# Maa Support

## 针对项目MaaFramework, 提供下列功能:

> 功能均基于interface.json的配置, 因此首次使用会自动提示进行初始化配置.
>
> 你也可以后续使用`Maa: 执行interface`命令触发初始化配置.

* 语义化资源分析
  * 查询任务定义
  * 查询任务引用
  * 重命名任务
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
  * 打开Webview后选择Crop页面直接截图, 裁剪图片

---

## 提供的vscode命令

* Maa: 打开日志
  * 打开MaaFramework的日志.
* Maa: 选择资源
  * 选择激活的interface.json, 也可以点击下方的 Maa Support 按钮.
* Maa: 跳转到任务
  * 搜索并跳转到指定任务.
* Maa: 执行任务
  * 基于interface配置创建实例, 然后执行任务.
* Maa: 执行interface
  * 以等价于MaaPiCli的效果执行interface.
* Maa: 停止执行
  * 终止执行任务/执行interface
* Maa: 打开Webview
  * 打开显示执行信息的Webview
