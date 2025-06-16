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
</script>

<template>
  <n-card :title="task.name" size="small" closable @close="removeTask">
    <template #header-extra>
      <n-flex>
        <!-- <n-button> 删除 </n-button> -->
      </n-flex>
    </template>

    <n-flex vertical>
      <template v-for="opt in taskMeta?.option ?? []" :key="opt">
        <n-text> {{ opt }} </n-text>
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
