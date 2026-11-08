import { ref } from 'vue'

/**
 * 画布当前操作模式。任意时刻只有一个模式生效，点选/框选/涂绿/圈选互斥。
 * pointer = 移动/调整已有 ROI（拖空白不再新建）；roi = 纯拖拽新建 ROI。
 * 各工具通过本模块的 setMode 切换，工具自身的开关状态由 mode 派生。
 */
export type CropMode = 'pointer' | 'roi' | 'pick-point' | 'pick-rect' | 'mask' | 'lasso'

export const mode = ref<CropMode>('pointer')

export function setMode(next: CropMode) {
  if (mode.value === next) {
    return
  }
  mode.value = next
}

/** 回到指针模式（退出当前工具），供 Esc / 停止按钮使用 */
export function exitMode() {
  setMode('pointer')
}
