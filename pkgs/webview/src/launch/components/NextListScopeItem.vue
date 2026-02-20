<script setup lang="ts">
import { NButton, NFlex } from 'naive-ui'

import type { NextListScope } from '../states/launch'
import RecoActionScopeItem from './RecoActionScopeItem.vue'

defineProps<{
  item: NextListScope
}>()
</script>

<template>
  <n-flex>
    <template v-for="(reco, idx) in item.childs" :key="`reco-${idx}`">
      <reco-action-scope-item
        :item="reco"
        :info="item.msg.list[idx]"
        use-warning
      ></reco-action-scope-item>
    </template>
    <template v-for="(reco, idx) in item.msg.list.slice(item.childs.length)" :key="`wait-${idx}`">
      <n-button size="small" ghost disabled>
        {{ reco.jump_back ? '[JumpBack]' : '' }} {{ reco.anchor ? '[Anchor]' : '' }} {{ reco.name }}
      </n-button>
    </template>
  </n-flex>
</template>
