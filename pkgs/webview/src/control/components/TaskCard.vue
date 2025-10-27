<script setup lang="ts">
import { NButton, NCard, NFlex } from 'naive-ui'
import { computed } from 'vue'

import type { InputOption, SelectOption, TaskConfig } from '@mse/types'

import { ipc } from '../ipc'
import { hostState } from '../state'
import TaskInputOption from './TaskInputOption.vue'
import TaskSelectOption from './TaskSelectOption.vue'

const props = defineProps<{
  task: TaskConfig
}>()

const taskMeta = computed(() => {
  return hostState.value.interfaceJson?.task?.find(info => info.name === props.task.name) ?? null
})

function removeTask() {
  if (!props.task.__vscKey) {
    return
  }
  ipc.send({
    command: 'removeTask',
    key: props.task.__vscKey
  })
}

function revealEntry() {
  ipc.send({
    command: 'revealInterface',
    dest: {
      type: 'entry',
      entry: props.task.name
    }
  })
}

function cast<T>(val: unknown): T {
  return val as T
}
</script>

<template>
  <n-card size="small" closable @close="removeTask">
    <template #header>
      <n-button size="large" @click="revealEntry" text> {{ task.name }} </n-button>
    </template>
    <n-flex vertical>
      <template v-for="opt in taskMeta?.option ?? []" :key="opt">
        <template v-if="hostState.interfaceJson?.option?.[opt]">
          <template v-if="(hostState.interfaceJson.option[opt].type ?? 'Select') === 'Select'">
            <task-select-option
              :task="task"
              :opt="opt"
              :opt-meta="cast<SelectOption>(hostState.interfaceJson.option[opt])"
            ></task-select-option>
          </template>
          <template v-else-if="hostState.interfaceJson.option[opt].type === 'Input'">
            <task-input-option
              :task="task"
              :opt="opt"
              :opt-meta="cast<InputOption>(hostState.interfaceJson.option[opt])"
            ></task-input-option>
          </template>
        </template>
      </template>
    </n-flex>
  </n-card>
</template>
