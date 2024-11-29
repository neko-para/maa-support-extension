<script setup lang="ts">
import type { Option } from '@vscode-elements/elements/dist/includes/vscode-select/types'
import { VscodeSingleSelect } from '@vscode-elements/elements/dist/vscode-single-select'
import { JSONStringify } from 'json-with-bigint'
import { computed, onMounted } from 'vue'

import { ipc } from './main'

const tryStringify = (v?: unknown) => {
  return v ? JSONStringify(v) : ''
}

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

const currentController = computed<string | undefined>({
  set(v?: string) {
    if (!ipc.context.value.interfaceObj?.controller?.find(x => x.name === v)) {
      v = undefined
    }
    if (v) {
      if (!ipc.context.value.interfaceConfigObj) {
        ipc.context.value.interfaceConfigObj = {
          controller: {
            name: v
          }
        }
      } else if (!ipc.context.value.interfaceConfigObj.controller) {
        ipc.context.value.interfaceConfigObj.controller = {
          name: v
        }
      } else {
        ipc.context.value.interfaceConfigObj.controller.name = v
      }
    }
  },
  get() {
    return ipc.context.value.interfaceConfigObj?.controller?.name
  }
})

const controllerOptions = computed<Option[]>(() => {
  return (
    ipc.context.value.interfaceObj?.controller?.map(i => {
      return {
        label: i.name,
        value: i.name,
        description: `${i.type}\n${tryStringify(i.type === 'Adb' ? i.adb : i.win32)}`,
        // selected: currentController.value === i.name,
        selected: false,
        disabled: false
      } satisfies Option
    }) ?? []
  )
})

onMounted(() => {
  refreshInterface()
})
</script>

<template>
  <div id="root">
    <div class="row-flex">
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
    <div class="row-flex">
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
    <div class="col-flex">
      <div class="row-flex">
        <span>控制</span>
        <vscode-single-select
          v-model="currentController"
          :options="controllerOptions"
          :disabled="ipc.context.value.interfaceRefreshing"
        >
        </vscode-single-select>
      </div>
    </div>
    <vscode-divider></vscode-divider>
    <div>
      <vscode-button @click="ipc.context.value = {}"> Reset </vscode-button>
    </div>
    <vscode-scrollable id="contextDump">
      <pre>{{ JSONStringify(ipc.context.value, 2) }}</pre>
    </vscode-scrollable>
  </div>
</template>

<style scoped>
.row-flex {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.col-flex {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

#root {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  height: 100%;
}

#contextDump {
  flex: 1 1 auto;
  overflow-y: auto;
}
</style>
