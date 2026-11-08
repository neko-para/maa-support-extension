import { computed, watch } from 'vue'

import * as autoMaskSt from './autoMask'
import * as greenMaskSt from './greenMask'
import * as imageSt from './image'
import * as matchSt from './quickMatch'
import * as subjectMaskSt from './subjectMask'
import * as subjectSelectSt from './subjectSelect'
import { sidePanel } from './visible'

/**
 * 绿幕的统一预览与应用：手动涂抹、自动去背景、圈选主体只是生成绿幕的不同方式，
 * 「应用到图像」把画布上看得到的绿色一次烘焙进图像，看不到的不写入。
 *
 * 本模块只被组件和 canvas 引用，不参与状态模块之间的循环导入。
 */

/** 涂绿面板在右栏可见时才叠加自动/圈选预览，避免画布上出现找不到来源的绿色 */
const sectionVisible = computed(() => sidePanel.value === 'mask')

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

// 圈完就生成绿幕预览；排除圈追加时也触发重算
watch(
  () => [subjectSelectSt.regionMask.value, subjectSelectSt.excludeVersion.value] as const,
  ([region]) => {
    if (!region) {
      subjectMaskSt.disable()
    } else if (lassoShown.value) {
      subjectMaskSt.generate()
    }
  }
)

// 切换生成方式时退出圈选模式；已画的笔画和圈选区域保留。
// 涂抹模式不退出：手动补笔在三种方式下都可用，与其他方式的预览一起应用
watch(
  () => greenMaskSt.method.value,
  method => {
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
  // set 会重置蒙版状态，快照必须在上图之后压栈；
  // 模板里一旦烘焙了绿幕，匹配参数必须打开 green_mask，否则涂了等于没涂，
  // 联动前的值一起进快照，撤销应用时逐层回退
  greenMaskSt.pushApplied({ image: previous, greenMaskBefore: matchSt.greenMask.value })
  // 烘焙后的新图四边已是绿色，继续预览只会把同一片绿色再标一遍
  autoMaskSt.setEnabled(false)
  matchSt.greenMask.value = true
  return true
}

export async function undoApply() {
  const snapshot = greenMaskSt.popApplied()
  if (!snapshot) {
    return
  }
  if (snapshot.image && (await imageSt.restoreWithoutHistory(snapshot.image))) {
    // apply() 联动打开的 green_mask 一起回退，恢复用户在此之前的选择
    if (snapshot.greenMaskBefore !== null) {
      matchSt.greenMask.value = snapshot.greenMaskBefore
    }
  } else {
    // 恢复失败时把快照放回去，层数和画布状态保持一致
    greenMaskSt.pushApplied(snapshot)
  }
}
