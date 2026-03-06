<script setup lang="ts">
import { NButton, NCard, NFlex, NPopover } from 'naive-ui'
import { computed } from 'vue'

import type { TaskConfig } from '@mse/types'
import type {
  CheckboxOption,
  InputOption,
  SelectOption,
  SwitchOption
} from '@nekosu/maa-pipeline-manager/logic'

import { ipc } from '../ipc'
import { hostState } from '../state'
import LocaleText from './LocaleText.vue'
import TaskCheckboxOption from './TaskCheckboxOption.vue'
import TaskInputOption from './TaskInputOption.vue'
import TaskSelectOption from './TaskSelectOption.vue'
import TaskSwitchOption from './TaskSwitchOption.vue'
import type { OptionInfo, OptionIntro } from './types'

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

const allOptions = computed<OptionInfo[]>(() => {
  const resolved: OptionInfo[] = []
  const options: OptionInfo[] = []

  const addOptions = (opts: string[] | undefined, intro: OptionIntro) => {
    if (opts) {
      for (const opt of opts) {
        options.push({
          option: opt,
          intro
        })
      }
    }
  }

  addOptions(hostState.value.interfaceJson?.global_option, {
    type: 'global_option'
  })

  const ctrlName = hostState.value.interfaceConfigJson?.controller?.name
  addOptions(
    hostState.value.interfaceJson?.controller?.find(ctrl => ctrl.name === ctrlName)?.option,
    {
      type: 'controller',
      name: ctrlName
    }
  )

  const resName = hostState.value.interfaceConfigJson?.resource
  addOptions(hostState.value.interfaceJson?.resource?.find(res => res.name === resName)?.option, {
    type: 'resource',
    name: resName
  })

  addOptions(taskMeta.value?.option, {
    type: 'task',
    name: props.task.name
  })

  while (options.length > 0) {
    const opt = options.shift()!
    if (resolved.findIndex(info => info.option === opt.option) !== -1) {
      continue
    }
    resolved.push(opt)

    const optMeta = hostState.value.interfaceJson?.option?.[opt.option]
    if (!optMeta) {
      continue
    }
    if ((optMeta.type ?? 'select') === 'select') {
      const selectMeta = optMeta as SelectOption

      const optValue = props.task.option?.[opt.option]?.default
      const val = optValue ?? selectMeta.default_case ?? selectMeta.cases?.[0]?.name
      if (val) {
        const caseMeta = selectMeta.cases?.find(cs => cs.name === val)

        addOptions(caseMeta?.option, {
          type: 'option',
          name: opt.option
        })
      }
    } else if (optMeta.type === 'checkbox') {
      const selectMeta = optMeta as CheckboxOption

      const optValue = props.task.option?.[opt.option]
      const val = (optValue ? Object.keys(optValue) : selectMeta.default_case) ?? []

      for (const caseMeta of selectMeta.cases ?? []) {
        if (val.includes(caseMeta.name)) {
          addOptions(caseMeta?.option, {
            type: 'option',
            name: opt.option
          })
        }
      }
    } else if (optMeta.type === 'switch') {
      const switchMeta = optMeta as SwitchOption

      const optValue = props.task.option?.[opt.option]?.default
      const val = optValue ?? switchMeta.default_case ?? switchMeta.cases?.[0]?.name
      if (val) {
        const caseMeta = switchMeta.cases?.find(cs => cs.name === val)

        addOptions(caseMeta?.option, {
          type: 'option',
          name: opt.option
        })
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
      <n-popover
        v-if="taskMeta"
        trigger="hover"
        :disabled="!taskMeta.label && !taskMeta.description"
      >
        <template #trigger>
          <n-button size="large" @click="revealEntry" text> {{ task.name }} </n-button>
        </template>

        <locale-text :text="taskMeta.label"></locale-text>
        <locale-text :text="taskMeta.description"></locale-text>
      </n-popover>
    </template>
    <n-flex vertical>
      <template v-for="opt in allOptions" :key="opt">
        <template v-if="hostState.interfaceJson?.option?.[opt.option]">
          <template
            v-if="(hostState.interfaceJson.option[opt.option]?.type ?? 'select') === 'select'"
          >
            <task-select-option
              :task="task"
              :opt="opt"
              :opt-meta="cast<SelectOption>(hostState.interfaceJson.option[opt.option])"
            ></task-select-option>
          </template>
          <template v-else-if="hostState.interfaceJson.option[opt.option]?.type === 'checkbox'">
            <task-checkbox-option
              :task="task"
              :opt="opt"
              :opt-meta="cast<CheckboxOption>(hostState.interfaceJson.option[opt.option])"
            ></task-checkbox-option>
          </template>
          <template v-else-if="hostState.interfaceJson.option[opt.option]?.type === 'input'">
            <task-input-option
              :task="task"
              :opt="opt"
              :opt-meta="cast<InputOption>(hostState.interfaceJson.option[opt.option])"
            ></task-input-option>
          </template>
          <template v-else-if="hostState.interfaceJson.option[opt.option]?.type === 'switch'">
            <task-switch-option
              :task="task"
              :opt="opt"
              :opt-meta="cast<SwitchOption>(hostState.interfaceJson.option[opt.option])"
            ></task-switch-option>
          </template>
        </template>
      </template>
    </n-flex>
  </n-card>
</template>
