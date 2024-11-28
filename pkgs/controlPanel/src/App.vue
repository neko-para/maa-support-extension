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
  ipc.postMessage({
    cmd: 'selectInterface',
    interface: i
  })
}

const current = computed<string | undefined>({
  set(v) {
    if (v) {
      selectInterface(v)
    }
  },
  get() {
    return ipc.context.value.interfaceCurrent
  }
})

onMounted(() => {
  refreshInterface()
})
</script>

<template>
  {{ ipc.context }}
  <div id="interfaceSelectGroup">
    <vscode-single-select v-model="current" :disabled="ipc.context.value.interfaceRefreshing">
      <vscode-option v-for="(i, k) in ipc.context.value.interfaceList ?? []" :key="k">
        {{ i }}
      </vscode-option>
    </vscode-single-select>
    <vscode-button
      :icon="ipc.context.value.interfaceRefreshing ? 'loading' : undefined"
      iconSpin
      :disabled="ipc.context.value.interfaceRefreshing"
      @click="refreshInterface"
    >
      刷新
    </vscode-button>
  </div>
</template>

<style scoped>
#interfaceSelectGroup {
  display: flex;
  gap: 0.5rem;
}
</style>
