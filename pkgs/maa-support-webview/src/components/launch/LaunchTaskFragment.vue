<script setup lang="ts">
import { NFlex } from 'naive-ui'

import type { TaskScope } from '../../states/launch'
import LaunchScopeFragment from './LaunchScopeFragment.vue'

defineProps<{
  item: TaskScope
}>()
</script>

<template>
  <n-flex vertical>
    <template v-for="(item, idx) in item.childs" :key="idx">
      <launch-scope-fragment :scope="item"></launch-scope-fragment>
    </template>
  </n-flex>
</template>
