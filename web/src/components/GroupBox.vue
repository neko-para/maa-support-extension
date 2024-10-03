<script setup lang="ts">
import { themeType } from '@/data'

defineProps<{
  title: string
}>()
</script>

<template>
  <div
    class="flex flex-col p-2 gap-2 border border-black rounded-md"
    :class="{
      'border-black': themeType === 'light',
      'border-white': themeType === 'dark'
    }"
  >
    <span class="font-bold self-center">
      {{ title }}
    </span>
    <slot></slot>
  </div>
</template>
