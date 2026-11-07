import { type Ref, ref, watch } from 'vue'

import type { CropSettings } from '@nekosu/maa-types'

import { ipc } from '../ipc'
import { hostState } from '../state'

/**
 * 面板布局偏好：本地 ref 立即生效，同时写回 host 的 CropSettings，
 * 下次打开面板时恢复，熟练用户折叠掉的区块不会每次重新展开。
 */
function usePersisted<K extends 'sidePanel' | 'toolSections' | 'testTarget'>(
  key: K,
  def: NonNullable<CropSettings[K]>
): Ref<NonNullable<CropSettings[K]>> {
  const local = ref(def) as Ref<NonNullable<CropSettings[K]>>
  watch(
    () => hostState.value[key],
    value => {
      if (value !== undefined && JSON.stringify(value) !== JSON.stringify(local.value)) {
        local.value = value as NonNullable<CropSettings[K]>
      }
    }
  )
  watch(
    local,
    value => {
      if (JSON.stringify(value) !== JSON.stringify(hostState.value[key])) {
        ipc.send({ command: 'updateSettings', key, value })
      }
    },
    { deep: true }
  )
  return local
}

export type SidePanel = NonNullable<CropSettings['sidePanel']>
export type ToolSection = 'test' | 'pick' | 'mask' | 'roi'
export type TestTarget = NonNullable<CropSettings['testTarget']>

/** 右栏显示哪个面板；首次打开默认展示工具，让新用户第一眼就看到能做什么 */
export const sidePanel = usePersisted('sidePanel', 'tool')
/** 工具面板里展开的区块；低频的 ROI 计算默认收起 */
export const toolSections = usePersisted('toolSections', ['test', 'pick', 'mask'])
/** 识别测试当前选中的目标 */
export const testTarget = usePersisted('testTarget', 'template')

export function toggleSidePanel(target: 'tool' | 'settings') {
  sidePanel.value = sidePanel.value === target ? 'hidden' : target
}

/** 打开工具面板并展开指定区块（例如外部送来识别详情、或从别的区块跳转） */
export function revealSection(section: ToolSection) {
  sidePanel.value = 'tool'
  if (!toolSections.value.includes(section)) {
    toolSections.value = [...toolSections.value, section]
  }
}
