<script setup lang="ts">
import { NInputNumber, NText } from 'naive-ui'

import type { SettingsInstance } from '../states/settings'

defineProps<{
  inst: SettingsInstance<number>
  title: string
  min?: number
  max?: number
  step?: number
  showButton?: boolean
}>()
</script>

<template>
  <n-text> {{ title }} </n-text>
  <n-input-number
    v-model:value="inst.val"
    :placeholder="`${inst.def}`"
    :min="min"
    :max="max"
    :step="step"
    :show-button="showButton"
    size="small"
  ></n-input-number>
</template>
