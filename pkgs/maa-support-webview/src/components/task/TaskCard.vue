<script setup lang="ts">
import { NButton, NCard, NFlex, NPopover } from 'naive-ui'
import { computed } from 'vue'

import type { InputOption, SelectOption, TaskConfig } from '@mse/types'

import { controlViewState } from '../../states/config'
import { request } from '../../utils/api'
import TaskInputOption from './TaskInputOption.vue'
import TaskSelectOption from './TaskSelectOption.vue'

const props = defineProps<{
  task: TaskConfig
}>()

const taskMeta = computed(() => {
  return (
    controlViewState.value.interfaceJson?.task?.find(info => info.name === props.task.name) ?? null
  )
})

function removeTask() {
  if (!props.task.__vscKey) {
    return
  }
  request('/interface/removeTask', { key: props.task.__vscKey })
}

function revealEntry() {
  // ipc.send({
  //   command: 'revealInterface',
  //   dest: {
  //     type: 'entry',
  //     entry: props.task.name
  //   }
  // })
}

const allOptions = computed<string[]>(() => {
  const resolved: string[] = []
  const options = [...(taskMeta.value?.option ?? [])]
  while (options.length > 0) {
    const opt = options.shift()!
    if (resolved.indexOf(opt) !== -1) {
      continue
    }
    resolved.push(opt)

    const optMeta = controlViewState.value.interfaceJson?.option?.[opt]
    if (!optMeta) {
      continue
    }
    if ((optMeta.type ?? 'Select') === 'Select') {
      const selectMeta = optMeta as SelectOption

      let optValue = props.task.option?.[opt]?.value
      if (typeof optValue === 'object') {
        optValue = undefined
      }
      const val = optValue ?? selectMeta.default_case ?? selectMeta.cases?.[0].name
      if (val) {
        const caseMeta = selectMeta.cases?.find(cs => cs.name === val)
        if (caseMeta?.options) {
          options.push(...caseMeta.options)
        }
      }
    }
  }
  return resolved
})

function cast<T>(val: unknown): T {
  return val as T
}
</script>

<template>
  <n-card size="small" closable @close="removeTask">
    <template #header>
      <n-popover v-if="taskMeta" trigger="hover" :disabled="!taskMeta.description">
        <template #trigger>
          <n-button size="large" @click="revealEntry" text> {{ task.name }} </n-button>
        </template>

        <span> {{ taskMeta.description }} </span>
      </n-popover>
    </template>
    <n-flex vertical>
      <template v-for="opt in allOptions" :key="opt">
        <template v-if="controlViewState.interfaceJson?.option?.[opt]">
          <template
            v-if="(controlViewState.interfaceJson.option[opt].type ?? 'Select') === 'Select'"
          >
            <task-select-option
              :task="task"
              :opt="opt"
              :opt-meta="cast<SelectOption>(controlViewState.interfaceJson.option[opt])"
            ></task-select-option>
          </template>
          <template v-else-if="controlViewState.interfaceJson.option[opt].type === 'Input'">
            <task-input-option
              :task="task"
              :opt="opt"
              :opt-meta="cast<InputOption>(controlViewState.interfaceJson.option[opt])"
            ></task-input-option>
          </template>
        </template>
      </template>
    </n-flex>
  </n-card>
</template>
