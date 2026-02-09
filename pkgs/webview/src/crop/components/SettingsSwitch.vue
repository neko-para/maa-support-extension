<script setup lang="ts">
import { NFlex, NSwitch, NText } from 'naive-ui'

import type { SettingsInstance } from '../states/settings'

defineProps<{
  inst: SettingsInstance<boolean>
  title: string
  on: string
  off: string
}>()
</script>

<template>
  <n-text> {{ title }} </n-text>
  <n-flex align="center">
    <n-switch v-model:value="inst.val" :default-value="inst.def"></n-switch>
    <n-text>
      {{ inst.eff ? on : off }}
    </n-text>
  </n-flex>
</template>
