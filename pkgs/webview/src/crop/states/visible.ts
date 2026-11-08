import { type Ref, ref, watch } from 'vue'

import type { CropSettings } from '@nekosu/maa-types'

import { ipc } from '../ipc'
import { hostState } from '../state'

/**
 * 面板布局偏好：本地 ref 立即生效，同时写回 host 的 CropSettings，
 * 下次打开面板时恢复，熟练用户折叠掉的区块不会每次重新展开。
 */
/**
 * 拖动会话深度：>0 时不接受 host 回放。
 * 拖动每帧都发 updateSettings，host 广播回来的 updateState 带着旧值，
 * 会把本地值打回去（浮窗反向抖动 / 拖不动的根因）。
 */
export const dragDepth = ref(0)

/** 合法的右栏面板值；host 里存的旧值（'tool' 等）落回默认而不是反复写回 host */
const VALID_PANELS = ['test', 'color', 'mask', 'calc', 'export', 'settings', 'hidden'] as const

function usePersisted<
  K extends
    | 'sidePanel'
    | 'testTarget'
    | 'nodeRoiSource'
    | 'pipelineVersion'
    | 'panelWidth'
    | 'panelFloat'
    | 'floatRect'
>(key: K, def: NonNullable<CropSettings[K]>): Ref<NonNullable<CropSettings[K]>> {
  const local = ref(def) as Ref<NonNullable<CropSettings[K]>>
  watch(
    () => hostState.value[key],
    value => {
      // 拖动中本地值优先：host 广播滞后一拍，回放会抵消正在进行的拖动
      if (dragDepth.value > 0) {
        return
      }
      if (value !== undefined) {
        if (key === 'sidePanel' && !(VALID_PANELS as readonly string[]).includes(value as string)) {
          // 旧值落回默认（偏好可丢）；不回写 host，避免死循环
          local.value = def
          return
        }
        if (JSON.stringify(value) !== JSON.stringify(local.value)) {
          local.value = value as NonNullable<CropSettings[K]>
        }
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
export type ToolSection = 'test' | 'pick' | 'mask' | 'calc'
export type TestTarget = NonNullable<CropSettings['testTarget']>
export type NodeRoiSource = NonNullable<CropSettings['nodeRoiSource']>
export type PipelineVersion = NonNullable<CropSettings['pipelineVersion']>

/** 右栏显示哪个面板；首次打开默认展示识别测试，让新用户第一眼就看到能做什么 */
export const sidePanel = usePersisted('sidePanel', 'test')

/** 顶栏「保存」等动作要切到导出面板时用这个入口（自动展开） */
export function revealExport() {
  sidePanel.value = 'export'
}

/** 识别测试当前选中的目标 */
export const testTarget = usePersisted('testTarget', 'template')
/** 节点试跑的 ROI 来源；默认节点自己的 ROI，画布选区为显式选择 */
export const nodeRoiSource = usePersisted('nodeRoiSource', 'node')
/** 复制 pipeline 片段的协议版本；默认 v2（纵深），MPE 与旧项目大多用 v1 平铺 */
export const pipelineVersion = usePersisted('pipelineVersion', 'v2')
/** 右栏宽度；拖拽调整的范围 300–560 */
export const PANEL_WIDTH_MIN = 300
export const PANEL_WIDTH_MAX = 560
export const panelWidth = usePersisted('panelWidth', 360)
/** 右栏是否悬浮显示 */
export const panelFloat = usePersisted('panelFloat', false)
/** 悬浮窗位置与尺寸；h 未设时按内容自适应（拖过角柄后才记住高度） */
export const floatRect = usePersisted('floatRect', { x: 60, y: 60, w: 360 } as {
  x: number
  y: number
  w: number
  h?: number
})

/** `?` 帮助浮层的显示状态（不持久化：开一次看一次） */
export const helpShown = ref(false)

/** 最近一次「跳转」目标：面板消费后滚动到位并闪烁区块头 */
export const flashSection = ref<ToolSection | null>(null)

/** 区块 → 右栏标签页：跳转即切到对应面板 */
const sectionPanel: Record<ToolSection, SidePanel> = {
  test: 'test',
  pick: 'color',
  mask: 'mask',
  calc: 'calc'
}

/** 打开对应面板（例如外部送来识别详情、或从别的区块跳转） */
export function revealSection(section: ToolSection) {
  sidePanel.value = sectionPanel[section]
  // 面板可能已经在显示，这时只靠切换不够——仍需要滚动到位 + 高亮
  flashSection.value = section
}

/** 面板处理完滚动/高亮后清除标记 */
export function clearFlash() {
  flashSection.value = null
}

/** 请求识别测试面板切到某目标并立即运行（颜色面板「用此色测试」等跨面板动作） */
export const runRequest = ref(0)

export function requestRun(target: TestTarget) {
  testTarget.value = target
  revealSection('test')
  runRequest.value += 1
}
