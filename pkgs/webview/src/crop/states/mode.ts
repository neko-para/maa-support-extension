import { ref } from 'vue'

/**
 * 画布当前操作模式。任意时刻只有一个模式生效，点选/框选/涂绿互斥。
 * 各工具通过本模块的 setMode 切换，不再各自维护独立布尔。
 */
export type CropMode = 'pointer' | 'pick-point' | 'pick-rect' | 'mask'

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
