<script setup lang="ts">
import { NButton, NCard, NFlex, NPopselect } from 'naive-ui'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import { computed } from 'vue'

import { t } from '../../utils/locale'
import TaskCard from '../components/TaskCard.vue'
import { ipc } from '../ipc'
import { hostState } from '../state'
import { makeBrief } from '../utils'

const taskOptions = computed(() => {
  return (hostState.value.interfaceJson?.task ?? [])
    .filter(info => {
      if (info.resource) {
        return info.resource.includes(hostState.value.interfaceConfigJson?.resource ?? '')
      }
      return true
    })
    .map((info, index) => {
      return {
        value: info.name,
        label: makeBrief(info.name)
      } satisfies SelectMixedOption
    })
})

function addTask(task: string) {
  ipc.send({
    command: 'addTask',
    task
  })
}
</script>

<template>
  <n-card :title="t('maa.control.task.task')" size="small">
    <template #header-extra>
      <n-popselect
        trigger="hover"
        :options="taskOptions"
        @update:value="addTask"
        size="small"
        scrollable
      >
        <n-button size="small"> {{ t('maa.control.task.add-task') }} </n-button>
      </n-popselect>
    </template>

    <n-flex vertical>
      <task-card
        v-for="task in hostState.interfaceConfigJson?.task ?? []"
        :key="task.__vscKey"
        :task="task"
      ></task-card>
    </n-flex>
  </n-card>
</template>
