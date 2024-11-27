<script setup lang="ts">
import { onMounted } from 'vue'

import { ipc } from './main'

onMounted(() => {
  ipc.context.value.counter += 1
})
</script>

<template>
  <vscode-button @click="ipc.context.value.counter++">
    aaa {{ ipc.context.value.counter }}
  </vscode-button>
</template>
