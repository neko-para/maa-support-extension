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
  ipc.context.value.selectedInterface = i
}

const selected = computed(() => {
  for (const i of ipc.context.value.interfaces ?? []) {
    if (i.path === ipc.context.value.selectedInterface) {
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
  {{ ipc.context }}
  <div id="interfaceSelectGroup">
    <vscode-single-select
      :disabled="ipc.context.value.refreshingInterface"
      @change="(ev: Event) => selectInterface((ev.target as VscodeSingleSelect).value)"
    >
      <vscode-option
        v-for="(i, k) in ipc.context.value.interfaces ?? []"
        :key="k"
        :selected="i.path === ipc.context.value.selectedInterface"
      >
        {{ i.path }}
      </vscode-option>
    </vscode-single-select>
    <vscode-button
      :icon="ipc.context.value.refreshingInterface ? 'loading' : undefined"
      iconSpin
      :disabled="ipc.context.value.refreshingInterface"
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
