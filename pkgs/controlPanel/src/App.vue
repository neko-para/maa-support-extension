<script setup lang="ts">
import { VscodeSingleSelect } from '@vscode-elements/elements/dist/vscode-single-select'
import { JSONStringify } from 'json-with-bigint'
import { computed, onMounted } from 'vue'

import { ipc } from './main'

function refreshInterface() {
  ipc.postMessage({
    cmd: 'refreshInterface'
  })
}

const currentInterface = computed<string | undefined>({
  set(v?: string) {
    if (v) {
      ipc.postMessage({
        cmd: 'selectInterface',
        interface: v
      })
    }
  },
  get() {
    return ipc.context.value.interfaceCurrent
  }
})

const currentResource = computed<string | undefined>({
  set(v?: string) {
    if (!ipc.context.value.interfaceObj?.resource?.find(x => x.name === v)) {
      v = undefined
    }
    if (v) {
      if (!ipc.context.value.interfaceConfigObj) {
        ipc.context.value.interfaceConfigObj = {
          resource: v
        }
      } else {
        ipc.context.value.interfaceConfigObj.resource = v
      }
    }
  },
  get() {
    return ipc.context.value.interfaceConfigObj?.resource
  }
})

function selectResource(v?: string) {
  if (!ipc.context.value.interfaceConfigObj) {
    ipc.context.value.interfaceConfigObj = {}
  }
  ipc.context.value.interfaceConfigObj.resource = v
}

onMounted(() => {
  refreshInterface()
})
</script>

<template>
  <div id="root">
    <div>
      <vscode-button @click="ipc.context.value = {}"> Reset </vscode-button>
    </div>

    <div id="interfaceSelectGroup">
      <span>配置</span>
      <vscode-single-select
        v-model="currentInterface"
        :disabled="ipc.context.value.interfaceRefreshing"
      >
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
    <div id="interfaceResourceSelectGroup">
      <span>资源</span>
      <vscode-single-select
        v-model="currentResource"
        :disabled="ipc.context.value.interfaceRefreshing"
      >
        <vscode-option
          v-for="(i, k) in ipc.context.value.interfaceObj?.resource ?? []"
          :key="k"
          :description="i.path"
        >
          {{ i.name }}
        </vscode-option>
      </vscode-single-select>
    </div>
    <div>
      <pre>{{ JSONStringify(ipc.context.value, 2) }}</pre>
    </div>
  </div>
</template>

<style scoped>
#root {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

#interfaceSelectGroup {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

#interfaceResourceSelectGroup {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
</style>
