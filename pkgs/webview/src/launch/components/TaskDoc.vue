<script setup lang="ts">
import { ref, watch } from 'vue'

import { ipc } from '../ipc'

const props = withDefaults(
  defineProps<{
    text?: string
  }>(),
  { text: '' }
)

const realText = ref<string>(props.text)

watch(
  () => props.text,
  async val => {
    realText.value = val
    const text = (await ipc.call({
      command: 'taskDoc',
      task: val
    })) as string
    realText.value = text
  },
  {
    immediate: true
  }
)
</script>

<template>
  <div style="max-width: 80vw" v-html="realText"></div>
</template>
