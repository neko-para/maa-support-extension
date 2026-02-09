<script lang="tsx" setup>
defineProps<{
  color: string
}>()
</script>

<template>
  <div :style="`width: 28px; height: 28px; background-color: ${color};`"></div>
</template>
