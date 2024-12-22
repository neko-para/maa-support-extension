<script lang="ts" setup>
import { ref } from 'vue'

import { ipc } from '@/launch/main'

const props = defineProps<{
  src: string
}>()

const show = ref(false)

function sendCrop() {
  ipc.postMessage({
    cmd: 'showCrop',
    image: props.src
  })
}
</script>

<template>
  <div class="relative" @mouseenter="show = true" @mouseleave="show = false">
    <img :src="src" />
    <div
      v-show="show"
      class="mse-bg-vscode-sideBar-background absolute left-0 top-0 flex opacity-90 p-1"
    >
      <vscode-icon class="opacity-100" name="edit" action-icon @click="sendCrop"></vscode-icon>
    </div>
  </div>
</template>
