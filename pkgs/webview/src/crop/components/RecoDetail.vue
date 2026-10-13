<script setup lang="tsx">
import { default as CheckOutlined } from '@vicons/material/es/CheckOutlined'
import { default as CloseOutlined } from '@vicons/material/es/CloseOutlined'
import { NIcon, NTree, type TreeOption } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { useDrawStep } from '../states/canvas'
import * as settingsSt from '../states/settings'
import { Box, Pos, Size } from '../utils/2d'

const props = defineProps<{
  detail: maa.RecoDetailWithoutDraws
}>()

type RichRecoDetailEntry = {
  name: string
  entry: maa.RecoDetailEntry
}

// 识别结果字段按算法不同：TemplateMatch 有 score，FeatureMatch / ColorMatch 有 count，
// OCR 有 text，NeuralNetworkClassify / NeuralNetworkDetect 有 cls_index / label；
// Custom 的 detail 不在此展示，看下方 JSON
function entryValue(entry: maa.RecoDetailEntry): string | undefined {
  if (entry.score !== undefined) {
    return entry.score.toFixed(4)
  }
  if (entry.count !== undefined) {
    return `count=${entry.count}`
  }
  const cls: string[] = []
  if (entry.cls_index !== undefined) {
    cls.push(`cls_index=${entry.cls_index}`)
  }
  if (entry.label !== undefined) {
    cls.push(`label=${entry.label}`)
  }
  if (cls.length > 0) {
    return cls.join(' ')
  }
  return undefined
}

function entryLabel(entry: maa.RecoDetailEntry): string {
  const value = entryValue(entry)
  return `[${entry.box.join(',')}]${value ? ` ${value}` : ''}${entry.text ? ` "${entry.text}"` : ''}`
}

function buildTree(
  detail: maa.RecoDetailWithoutDraws,
  leaves: Record<string, RichRecoDetailEntry>,
  prefix = ''
): TreeOption {
  const key = `${prefix}${detail.name}`
  let childs: TreeOption[] | undefined = undefined
  if (Array.isArray(detail.detail)) {
    childs = detail.detail.map(sub => buildTree(sub, leaves, `${prefix}${detail.name}.`))
  } else if (detail.detail) {
    const makeEntry = (sub: string, entry: maa.RecoDetailEntry) => {
      leaves[`${key}.${sub}`] = {
        name: `${detail.name} ${sub}`,
        entry
      }
      return {
        key: `${key}.${sub}`,
        label: entryLabel(entry)
      } satisfies TreeOption
    }
    childs = []
    if (detail.detail.best) {
      childs.push(makeEntry('best!', detail.detail.best))
    }
    childs.push({
      key: `${key}.all`,
      label: 'all',
      children: detail.detail.all.map((entry, idx) => makeEntry(`all[${idx}]!`, entry))
    })
    if (detail.detail.filtered.length > 0) {
      childs.push({
        key: `${key}.filtered`,
        label: 'filtered',
        children: detail.detail.filtered.map((entry, idx) => makeEntry(`filtered[${idx}]!`, entry))
      })
    }
  }
  return {
    key,
    label: `${detail.algorithm} ${detail.name}`,
    children: childs,
    prefix: () => {
      if (detail.hit === true) {
        return (
          <NIcon>
            <CheckOutlined></CheckOutlined>
          </NIcon>
        )
      } else if (detail.hit === false) {
        return (
          <NIcon>
            <CloseOutlined></CloseOutlined>
          </NIcon>
        )
      }
      return undefined
    }
  }
}

const treeData = computed(() => {
  const leaves: Record<string, RichRecoDetailEntry> = {}
  const tree = [buildTree(props.detail, leaves)]
  return {
    tree,
    leaves
  }
})

const checked = ref<string[]>([])

watch(
  () => treeData.value.leaves,
  () => {
    checked.value = Object.keys(treeData.value.leaves).filter(k => k.endsWith('best!'))
  }
)

useDrawStep((ctx, vp) => {
  ctx.fillStyle = settingsSt.recoStroke.eff
  ctx.strokeStyle = settingsSt.recoStroke.eff
  ctx.font = settingsSt.recoFont.eff

  for (const key of checked.value) {
    const info = treeData.value.leaves[key]
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
})
</script>

<template>
  <n-tree
    :data="treeData.tree"
    v-model:checked-keys="checked"
    checkable
    check-strategy="child"
    :check-on-click="node => (node.key as string).endsWith('!')"
    cascade
    expand-on-click
    default-expand-all
  >
  </n-tree>
</template>
