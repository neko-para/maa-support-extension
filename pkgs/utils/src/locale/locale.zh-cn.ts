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
  'maa.pi.error.cannot-find-option': '无法找到选项 {0}',
  'maa.pi.error.cannot-find-case-for-option': '无法找到选项 {1} 的值 {0}',
  'maa.pi.error.no-devices-found': '未找到设备',
  'maa.pi.error.no-win32-config-provided': '未提供 Win32 配置',
  'maa.pi.error.load-interface-failed': '无法加载interface',

  'maa.pipeline.codelens.launch': '执行',

  'maa.pipeline.error.no-interface-found': '未找到interface',
  'maa.pipeline.error.not-exists': '{0} 不存在',
  'maa.pipeline.error.conflict-task': '冲突任务 {0}, 上一个定义在 {1}',
  'maa.pipeline.error.unknown-task': '未知任务 {0}',
  'maa.pipeline.error.unknown-image': '未知图片 {0}',
  'maa.pipeline.error.duplicate-next': '重复路由 {0}',
  'maa.pipeline.error.rename-not-allowed': '重命名: 无效',
  'maa.pipeline.error.rename-already-exists': '重命名: 已存在',

  'maa.pipeline.status.no-interface-found': 'Maa: 未找到 interface',
  'maa.pipeline.status.using-interface': 'Maa: 正在使用 {0}',
  'maa.pipeline.status.load-interface-failed': 'Maa: 加载 interface 失败',
  'maa.pipeline.status.interface-not-configured': 'Maa: interface 未配置',
  'maa.pipeline.status.interface-configured': 'Maa: interface 已配置',
  'maa.pipeline.status.tooltip.click-select-interface': '点击以选择 interface',
  'maa.pipeline.status.tooltip.click-launch-interface': '点击以执行 interface',

  'maa.crop.warning.no-resource': '未配置interface的资源, 将直接保存'
} as const
