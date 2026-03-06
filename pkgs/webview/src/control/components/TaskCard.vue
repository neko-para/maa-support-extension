<script setup lang="ts">
import { NButton, NCard, NFlex, NPopover } from 'naive-ui'
import { computed } from 'vue'

import {
  type CheckboxOption,
  type InputOption,
  type OptionTrace,
  type SelectOption,
  type SwitchOption,
  type TaskConfig,
  buildOption
} from '@nekosu/maa-pipeline-manager/logic'

import { ipc } from '../ipc'
import { ctrlRt, interfaceJson, resRt } from '../state'
import LocaleText from './LocaleText.vue'
import TaskCheckboxOption from './TaskCheckboxOption.vue'
import TaskInputOption from './TaskInputOption.vue'
import TaskSelectOption from './TaskSelectOption.vue'
import TaskSwitchOption from './TaskSwitchOption.vue'

const props = defineProps<{
  task: TaskConfig
}>()

const taskMeta = computed(() => {
  return interfaceJson.value?.task?.find(info => info.name === props.task.name) ?? null
})

function removeTask() {
  if (!props.task.__key) {
    return
  }
  ipc.send({
    command: 'removeTask',
    key: props.task.__key
  })
}
function revealTask() {
  ipc.send({
    command: 'revealInterface',
    dest: {
      type: 'task',
      task: props.task.name
    }
  })
}

function revealEntry() {
  ipc.send({
    command: 'revealInterface',
    dest: {
      type: 'entry',
      entry: taskMeta.value!.entry,
      task: props.task.name
    }
  })
}

const allOptions = computed<OptionTrace[]>(() => {
  if (!interfaceJson.value || !ctrlRt.value.rt || !resRt.value.rt) {
    return []
  }
  const opts = buildOption(interfaceJson.value, props.task, ctrlRt.value.rt, resRt.value.rt)
  return typeof opts === 'string' ? [] : opts
})

function cast<T>(val: unknown): T {
  return val as T
}
</script>

<template>
  <n-card size="small" closable @close="removeTask">
    <template #header>
      <n-flex>
        <n-popover
          v-if="taskMeta"
          trigger="hover"
          :disabled="!taskMeta.label && !taskMeta.description"
        >
          <template #trigger>
            <n-button size="large" @click="revealTask" text> {{ task.name }} </n-button>
          </template>

          <locale-text :text="taskMeta.label"></locale-text>
          <locale-text :text="taskMeta.description"></locale-text>
        </n-popover>

        <n-button v-if="taskMeta" size="large" @click="revealEntry" text>
          {{ taskMeta.entry }}
        </n-button>
      </n-flex>
    </template>
    <n-flex vertical>
      <template v-for="opt in allOptions" :key="opt">
        <template v-if="interfaceJson?.option?.[opt.name]">
          <template v-if="(interfaceJson.option[opt.name]?.type ?? 'select') === 'select'">
            <task-select-option
              :task="task"
              :opt="opt"
              :opt-meta="cast<SelectOption>(interfaceJson.option[opt.name])"
            ></task-select-option>
          </template>
          <template v-else-if="interfaceJson.option[opt.name]?.type === 'checkbox'">
            <task-checkbox-option
              :task="task"
              :opt="opt"
              :opt-meta="cast<CheckboxOption>(interfaceJson.option[opt.name])"
            ></task-checkbox-option>
          </template>
          <template v-else-if="interfaceJson.option[opt.name]?.type === 'input'">
            <task-input-option
              :task="task"
              :opt="opt"
              :opt-meta="cast<InputOption>(interfaceJson.option[opt.name])"
            ></task-input-option>
          </template>
          <template v-else-if="interfaceJson.option[opt.name]?.type === 'switch'">
            <task-switch-option
              :task="task"
              :opt="opt"
              :opt-meta="cast<SwitchOption>(interfaceJson.option[opt.name])"
            ></task-switch-option>
          </template>
        </template>
      </template>
    </n-flex>
  </n-card>
</template>
