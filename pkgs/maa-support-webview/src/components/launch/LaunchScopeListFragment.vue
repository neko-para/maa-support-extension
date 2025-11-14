<script setup lang="ts">
import { NCard } from 'naive-ui'

import type { AnyContextScope } from '../../states/launch'
import LaunchScopeFragment from './LaunchScopeFragment.vue'

defineProps<{
  scopes: AnyContextScope[]
}>()
</script>

<template>
  <n-card size="small">
    <template v-for="(scope, idx) in scopes" :key="idx">
      <launch-scope-fragment :scope="scope"></launch-scope-fragment>
    </template>
  </n-card>
</template>
