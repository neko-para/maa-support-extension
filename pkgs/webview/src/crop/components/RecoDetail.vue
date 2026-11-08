<script setup lang="tsx">
import { default as CheckOutlined } from '@vicons/material/es/CheckOutlined'
import { default as CloseOutlined } from '@vicons/material/es/CloseOutlined'
import { NIcon, NTree, type TreeOption } from 'naive-ui'
import { computed, watch } from 'vue'

import * as drawResultSt from '../states/drawResult'
import { type DrawLeaf } from '../states/drawResult'
import { entryValue } from '../utils/recoDetail'

const props = withDefaults(
  defineProps<{
    detail: maa.RecoDetailWithoutDraws
    /** 是否把勾选的条目画到画布上（画布绘制由 states/drawResult 常驻步骤执行） */
    draw?: boolean
  }>(),
  { draw: true }
)

type RichRecoDetailEntry = DrawLeaf

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

const checked = drawResultSt.checked

// 勾选集合和候选集合都写进 drawResult：画布绘制归 drawResult 常驻步骤，
// 组件卸载（收起区块/切面板）只影响树视图，不影响画布上的结果框。
watch(
  () => treeData.value.leaves,
  next => {
    drawResultSt.leaves.value = next
    checked.value = Object.keys(next).filter(k => k.endsWith('best!'))
  },
  { immediate: true }
)

watch(
  () => props.draw,
  draw => {
    drawResultSt.visible.value = draw
  },
  { immediate: true }
)
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
