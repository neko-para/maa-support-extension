export default {
  'maa.pi.entry.switch-controller': '更改控制器',
  'maa.pi.entry.switch-resource': '更改资源',
  'maa.pi.entry.add-task': '添加任务',
  'maa.pi.entry.move-task': '移动任务',
  'maa.pi.entry.remove-task': '删除任务',
  'maa.pi.entry.launch': '执行',

  'maa.pi.title.choose-action': '选择操作',
  'maa.pi.title.select-controller': '选择控制台',
  'maa.pi.title.select-device': '选择设备',
  'maa.pi.title.select-window': '选择窗口',
  'maa.pi.title.select-resource': '选择资源',
  'maa.pi.title.select-task': '选择任务',
  'maa.pi.title.select-option': '选择选项 {0}',
  'maa.pi.title.input-image': '输入图片名称',
  'maa.pi.title.init-config': '初始化配置',
  'maa.pi.item.empty-config': '空配置',
  'maa.pi.item.interactive-setup-config': '交互式设置配置',

  'maa.pi.error.cannot-find-controller': '无法找到控制器 {0}',
  'maa.pi.error.cannot-find-adb-for-controller': '无法找到控制器 {0} 的 Adb 配置',
  'maa.pi.error.cannot-find-win32-for-controller': '无法找到控制器 {0} 的 Win32 配置',
  'maa.pi.error.cannot-find-hwnd-for-controller':
    '无法找到控制器 {0} 的 Win32 配置的 hwnd, 请重新配置控制器',
  'maa.pi.error.cannot-find-resource': '无法找到资源 {0}',
  'maa.pi.error.cannot-find-task': '无法找到任务 {0}',
  'maa.pi.error.cannot-find-option': '无法找到选项组 {0}',
  'maa.pi.error.cannot-find-case-for-option': '无法找到选项组 {1} 的值 {0}',
  'maa.pi.error.no-devices-found': '未找到设备',
  'maa.pi.error.no-win32-config-provided': '未提供 Win32 配置',
  'maa.pi.error.load-interface-failed': '无法加载interface',
  'maa.pi.error.generate-runtime-failed': '生成配置失败: {0}',

  'maa.debug.init-controller-failed': '初始化控制器失败',
  'maa.debug.init-resource-failed': '初始化资源失败',
  'maa.debug.init-instance-failed': '初始化实例失败',
  'maa.debug.init-instance-succeeded': '初始化实例成功',
  'maa.debug.task-started': '任务开始 {0} - {1}',
  'maa.debug.task-finished': '任务完成 {0} - {1}',
  'maa.debug.task-failed': '任务失败 {0} - {1}',

  'maa.pipeline.codelens.launch': '执行',
  'maa.pipeline.codelens.resource-switch': '切换',
  'maa.pipeline.codelens.resource-activated': '已激活',

  'maa.pipeline.error.no-interface-found': '未找到interface',
  'maa.pipeline.error.not-exists': '{0} 不存在',
  'maa.pipeline.error.conflict-task': '冲突任务 {0}, 上一个定义在 {1}',
  'maa.pipeline.error.unknown-task': '未知任务 {0}',
  'maa.pipeline.error.unknown-image': '未知图片 {0}',
  'maa.pipeline.error.duplicate-next': '重复路由 {0}',
  'maa.pipeline.warning.image-path-backslash': '图片路径中包含反斜杠, 应使用正斜杠',
  'maa.pipeline.warning.image-path-missing-png': '图片路径不应省略.png',

  'maa.native.in-use': '正在使用',
  'maa.native.downloaded': '已下载',
  'maa.native.extension-expected-version': '插件预期版本',
  'maa.native.auto': '自动',
  'maa.native.use-extension-expected-version': '自动使用插件预期版本',
  'maa.native.switch-mirror': '切换下载源(重启生效)',
  'maa.native.switch-maafw': '切换 MaaFramework 版本(重启生效)',
  'maa.native.fetching-index': '获取索引中',
  'maa.native.download.preparing-folder': '准备目录中',
  'maa.native.download.downloading-scripts': '下载 MaaFramework {0} 脚本中',
  'maa.native.download.downloading-binary': '下载 MaaFramework {0} 二进制中',
  'maa.native.download.moving-folder': '移动目录中',

  'maa.status.checking-task': 'MaaSupport 检查任务中',
  'maa.status.not-loaded': '未加载',

  'maa.core.cannot-find-log': '无法找到日志文件: {0}',
  'maa.core.load-maafw-failed': '加载 MaaFramework 失败',

  'maa.crop.warning.no-resource': '未配置interface的资源, 将直接保存'
} as const
