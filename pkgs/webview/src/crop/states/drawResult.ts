import { computed, ref } from 'vue'

import { Box, Pos, Size } from '../utils/2d'
import { entryValue } from '../utils/recoDetail'
import type { DrawStep } from './canvas'
import * as settingsSt from './settings'

/**
 * 画布上的识别框归属：由结果数据驱动，而不是 RecoDetail 组件的生命周期。
 * 收起识别测试区块、切到设置页都不会让画布上的结果框消失；
 * 是否画只由「显示结果」开关决定。
 *
 * 本模块只用 DrawStep 类型、不 import canvas 本体，因此可以作为叶子模块
 * 被 image.ts 等状态模块安全引用；绘制步骤由 App.vue 通过 addDrawStep 注册。
 */

export type DrawLeaf = {
  /** 勾选列表里显示的标识，例如 "TemplateMatch best!" */
  name: string
  entry: maa.RecoDetailEntry
}

/** 可勾选的候选集合（由 RecoDetail 的 n-tree 勾选驱动），key 与树节点一致 */
export const leaves = ref<Record<string, DrawLeaf>>({})
/** 当前勾选的条目 key；默认勾选 best */
export const checked = ref<string[]>([])
/** 「显示结果」开关：把结果框画到画布上 */
export const visible = ref(true)

/** 常驻绘制步骤：生命周期独立于任何组件，由 App.vue 注册进 canvas drawSteps */
export const drawStep: DrawStep = (ctx, vp) => {
  if (!visible.value) {
    return
  }
  ctx.fillStyle = settingsSt.recoStroke.eff
  ctx.strokeStyle = settingsSt.recoStroke.eff
  ctx.font = settingsSt.recoFont.eff

  for (const key of checked.value) {
    const info = leaves.value[key]
    if (!info) {
      continue
    }
    const { name, entry } = info

    const box = vp.toView(
      Box.from(Pos.from(entry.box[0], entry.box[1]), Size.from(entry.box[2], entry.box[3]))
    )
    ctx.rect(...box.flat())
    ctx.stroke()

    if (!name.startsWith('@mse/')) {
      ctx.fillText(name.slice(0, -1), ...box.rt.add(Size.from(5, 0)).flat())
    }
    const value = entryValue(entry)
    if (value) {
      const width = ctx.measureText(value).width
      ctx.fillText(value, ...box.lt.sub(Size.from(width, 0)).flat())
    }

    if (entry.text) {
      ctx.fillText(entry.text, ...box.rb.add(Size.from(5, 0)).flat())
    }
  }
}

/** 新结果/切图时复位勾选集；切图见 quickMatch/reco 的 resetForImageChange */
export function reset() {
  leaves.value = {}
  checked.value = []
}

/** 是否已有可画的结果（没有候选时画布上自然为空） */
export const hasEntries = computed(() => Object.keys(leaves.value).length > 0)
