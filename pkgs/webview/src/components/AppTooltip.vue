<script setup lang="ts">
import { NTooltip } from 'naive-ui'
import { computed } from 'vue'

import { tooltipDisabled } from '../utils/tooltip'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: undefined
  }
})

const isDisabled = computed(() => props.disabled ?? tooltipDisabled.value)
</script>

<template>
  <slot v-if="isDisabled" name="trigger" />
  <n-tooltip v-else v-bind="$attrs">
    <template #trigger>
      <slot name="trigger" />
    </template>
    <slot />
  </n-tooltip>
</template>
