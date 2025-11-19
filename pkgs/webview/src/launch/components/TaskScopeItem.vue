<script setup lang="ts">
import { NFlex } from 'naive-ui'

import type { TaskScope } from '../states/launch'
import NodeScopeItem from './NodeScopeItem.vue'

defineProps<{
  item: TaskScope
}>()
</script>

<template>
  <n-flex vertical>
    <template v-for="(sub, idx) in item.childs" :key="idx">
      <node-scope-item :item="sub"></node-scope-item>
    </template>
  </n-flex>
</template>
