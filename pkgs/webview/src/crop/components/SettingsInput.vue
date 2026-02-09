<script lang="ts" setup>
import { NFlex, NInput, NText } from 'naive-ui'

import type { SettingsInstance } from '../states/settings'
import ColorBox from './ColorBox.vue'

defineProps<{
  inst: SettingsInstance<string>
  title: string
  isColor?: boolean
}>()
</script>

<template>
  <n-text> {{ title }} </n-text>
  <n-flex>
    <div style="flex-grow: 1">
      <n-input v-model:value="inst.val" :placeholder="inst.def" size="small"></n-input>
    </div>
    <color-box v-if="isColor" :color="inst.eff"></color-box>
  </n-flex>
</template>
