<script setup lang="ts">
import { NButton, NCard, NFlex, NSelect, NText } from 'naive-ui'
import { computed } from 'vue'

import type { TaskConfig } from '@mse/types'

import { ipc } from '../ipc'
import { hostState } from '../state'

const props = defineProps<{
  task: TaskConfig
}>()

const taskMeta = computed(() => {
  return hostState.value.interfaceJson?.task?.find(info => info.name === props.task.name) ?? null
})

const optionsMetas = computed(() => {
  return (
    taskMeta.value?.option
      ?.map(opt => {
        return hostState.value.interfaceJson?.option?.[opt]
      })
      .filter(x => !!x) ?? []
  )
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

function configTask(option: string, value: string) {
  if (!props.task.__vscKey) {
    return
  }
  ipc.send({
    command: 'configTask',
    key: props.task.__vscKey,
    option,
    value
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

function revealOption(opt: string) {
  ipc.send({
    command: 'revealInterface',
    dest: {
      type: 'option',
      option: opt
    }
  })
}

function revealCase(opt: string) {
  const value =
    props.task.option?.find(info => info.name === opt)?.value ??
    hostState.value.interfaceJson?.option?.[opt].default_case ??
    hostState.value.interfaceJson?.option?.[opt].cases[0].name
  if (value) {
    ipc.send({
      command: 'revealInterface',
      dest: {
        type: 'case',
        option: opt,
        case: value
      }
    })
  }
}
</script>

<template>
  <n-card size="small" closable @close="removeTask">
    <template #header>
      <n-button size="large" @click="revealEntry" text> {{ task.name }} </n-button>
    </template>
    <n-flex vertical>
      <template v-for="opt in taskMeta?.option ?? []" :key="opt">
        <n-flex>
          <n-button @click="revealOption(opt)" text> {{ opt }} </n-button>
          <n-button @click="revealCase(opt)" text> 当前值 </n-button>
        </n-flex>
        <n-select
          :options="
            hostState.interfaceJson?.option?.[opt].cases.map(cs => ({
              value: cs.name,
              label: cs.name
            }))
          "
          :value="task.option?.find(info => info.name === opt)?.value ?? null"
          @update:value="
            value => {
              configTask(opt, value)
            }
          "
          :placeholder="
            hostState.interfaceJson?.option?.[opt].default_case ??
            hostState.interfaceJson?.option?.[opt].cases[0].name
          "
          size="small"
        ></n-select>
      </template>
    </n-flex>
  </n-card>
</template>
