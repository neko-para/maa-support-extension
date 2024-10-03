<script setup lang="ts">
import { themeType } from '@/data'

defineProps<{
  status: 'running' | 'success' | 'failed' | null
}>()
</script>

<template>
  <span
    v-if="status === null || status === 'running'"
    :class="{
      'text-slate-500': themeType === 'light',
      'text-white': themeType === 'dark'
    }"
  >
    <slot></slot>
  </span>
  <span
    v-else-if="status === 'success'"
    :class="{
      'text-green-500': themeType === 'light',
      'text-green-300': themeType === 'dark'
    }"
  >
    <slot></slot>
  </span>
  <span
    v-else-if="status === 'failed'"
    :class="{
      'text-red-500': themeType === 'light',
      'text-red-300': themeType === 'dark'
    }"
  >
    <slot></slot>
  </span>
</template>
