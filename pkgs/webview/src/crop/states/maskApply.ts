import { computed, watch } from 'vue'

import * as autoMaskSt from './autoMask'
import * as greenMaskSt from './greenMask'
import * as imageSt from './image'
import * as matchSt from './quickMatch'
import * as subjectMaskSt from './subjectMask'
import * as subjectSelectSt from './subjectSelect'
import { sidePanel, toolSections } from './visible'

/**
 * 绿幕的统一预览与应用：手动涂抹、自动去背景、圈选主体只是生成绿幕的不同方式，
 * 「应用到图像」把画布上看得到的绿色一次烘焙进图像，看不到的不写入。
 *
 * 本模块只被组件和 canvas 引用，不参与状态模块之间的循环导入。
 */

/** 绿幕区块在右栏可见时才叠加自动/圈选预览，避免画布上出现找不到来源的绿色 */
const sectionVisible = computed(
  () => sidePanel.value === 'tool' && toolSections.value.includes('mask')
)

/** 圈选的区域与绿幕预览是否画在画布上 */
export const lassoShown = computed(
  () => sectionVisible.value && greenMaskSt.method.value === 'lasso'
)

// 切到「自动去背景」就直接预览，离开或收起区块时关闭；预览开关仍可手动切换
watch(
  () => sectionVisible.value && greenMaskSt.method.value === 'auto',
  active => {
    autoMaskSt.setEnabled(active)
  },
  { immediate: true }
)

// 圈完就生成绿幕预览，不再需要单独点「生成预览」
watch(
  () => subjectSelectSt.regionMask.value,
  region => {
    if (!region) {
      subjectMaskSt.disable()
    } else if (lassoShown.value) {
      subjectMaskSt.generate()
    }
  }
)

// 切换生成方式时退出上一种方式的画布模式；已画的笔画和圈选区域保留
watch(
  () => greenMaskSt.method.value,
  method => {
    if (method !== 'manual') {
      greenMaskSt.drawing.value = false
    }
    if (method !== 'lasso' && subjectSelectSt.active.value) {
      subjectSelectSt.cancel()
    }
  }
)

const autoPending = computed(
  () =>
    autoMaskSt.enabled.value &&
    !!autoMaskSt.previewCanvas.value &&
    autoMaskSt.backgroundPixels.value > 0
)
const lassoPending = computed(
  () => lassoShown.value && subjectMaskSt.enabled.value && !!subjectMaskSt.previewCanvas.value
)

/** 画布上是否有可以应用的绿色 */
export const pending = computed(
  () => greenMaskSt.hasContent.value || autoPending.value || lassoPending.value
)

/** apply() 联动打开 green_mask 前的值，undoApply 时回退 */
let greenMaskBeforeApply: boolean | null = null

export async function apply() {
  const img = imageSt.element.value
  if (!img || !pending.value) {
    return false
  }

  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)

  let painted = greenMaskSt.paintInto(image)
  if (autoPending.value && autoMaskSt.paintInto(image)) {
    painted = true
  }
  if (lassoPending.value && subjectMaskSt.paintInto(image)) {
    painted = true
  }
  if (!painted) {
    return false
  }
  ctx.putImageData(image, 0, 0)

  const previous = imageSt.data.value
  if (!(await imageSt.set(canvas.toDataURL('image/png')))) {
    return false
  }
  // set 会重置蒙版状态，快照必须在上图之后记录
  greenMaskSt.markApplied(previous)
  // 烘焙后的新图四边已是绿色，继续预览只会把同一片绿色再标一遍
  autoMaskSt.setEnabled(false)
  // 模板里一旦烘焙了绿幕，匹配参数必须打开 green_mask，否则涂了等于没涂；
  // 记住联动前的值，撤销应用时一并回退
  greenMaskBeforeApply = matchSt.greenMask.value
  matchSt.greenMask.value = true
  return true
}

export async function undoApply() {
  const previous = greenMaskSt.appliedFrom.value
  if (previous && (await imageSt.restoreWithoutHistory(previous))) {
    greenMaskSt.markRestored()
    // apply() 联动打开的 green_mask 一起回退，恢复用户在此之前的选择
    if (greenMaskBeforeApply !== null) {
      matchSt.greenMask.value = greenMaskBeforeApply
      greenMaskBeforeApply = null
    }
  }
}
