<script setup lang="ts">
import { VscodeSingleSelect } from '@vscode-elements/elements/dist/vscode-single-select'
import { onMounted } from 'vue'

import { ipc } from './main'

function refreshInterface() {
  ipc.postMessage({
    cmd: 'refreshInterface'
  })
}

function selectInterface(i: string) {
  ipc.webvContext.value.selectedInterface = i
}

onMounted(() => {
  refreshInterface()
})
</script>

<template>
  {{ ipc.hostContext }}
  {{ ipc.webvContext }}
  <div id="interfaceSelectGroup">
    <vscode-single-select
      @change="(ev: Event) => selectInterface((ev.target as VscodeSingleSelect).value)"
    >
      <vscode-option
        v-for="(i, k) in ipc.hostContext.value.interfaces ?? []"
        :key="k"
        :selected="i === ipc.webvContext.value.selectedInterface"
      >
        {{ i }}
      </vscode-option>
    </vscode-single-select>
    <vscode-button @click="refreshInterface"> 刷新 </vscode-button>
  </div>
</template>

<style scoped>
#interfaceSelectGroup {
  display: flex;
  gap: 0.5rem;
}
</style>
