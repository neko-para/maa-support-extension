<script setup lang="ts">
import { VscodeSingleSelect } from '@vscode-elements/elements/dist/vscode-single-select'
import { computed, onMounted } from 'vue'

import { ipc } from './main'

function refreshInterface() {
  ipc.postMessage({
    cmd: 'refreshInterface'
  })
}

function selectInterface(i: string) {
  ipc.webvContext.value.selectedInterface = i
}

const selected = computed(() => {
  for (const i of ipc.hostContext.value.interfaces ?? []) {
    if (i.path === ipc.webvContext.value.selectedInterface) {
      return i
    }
  }
  return null
})

onMounted(() => {
  refreshInterface()
})
</script>

<template>
  {{ ipc.hostContext }}
  {{ ipc.webvContext }}
  <div id="interfaceSelectGroup">
    <vscode-single-select
      :disabled="ipc.hostContext.value.refreshingInterface"
      @change="(ev: Event) => selectInterface((ev.target as VscodeSingleSelect).value)"
    >
      <vscode-option
        v-for="(i, k) in ipc.hostContext.value.interfaces ?? []"
        :key="k"
        :selected="i.path === ipc.webvContext.value.selectedInterface"
      >
        {{ i.path }}
      </vscode-option>
    </vscode-single-select>
    <vscode-button
      :icon="ipc.hostContext.value.refreshingInterface ? 'loading' : undefined"
      iconSpin
      :disabled="ipc.hostContext.value.refreshingInterface"
      @click="refreshInterface"
    >
      刷新
    </vscode-button>
  </div>
  <code>
    <pre>{{ JSON.stringify(selected?.content ?? {}, null, 2) }}</pre>
  </code>
</template>

<style scoped>
#interfaceSelectGroup {
  display: flex;
  gap: 0.5rem;
}
</style>
