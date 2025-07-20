<script setup lang="ts">
import { NFlex } from 'naive-ui'

import type { NextListScope } from '../states/task'
import StatusRow from './StatusRow.vue'

defineProps<{
  items: NextListScope[]
}>()
</script>

<template>
  <n-flex vertical>
    <template v-for="(item, idx) in items" :key="idx">
      <status-row :item="item"></status-row>
    </template>
  </n-flex>
</template>
