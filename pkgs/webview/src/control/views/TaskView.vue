<script setup lang="ts">
import { NButton, NCard, NFlex, NPopselect, NTree, type TreeOption } from 'naive-ui'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import { computed, ref } from 'vue'

import TaskCard from '../components/TaskCard.vue'
import { ipc } from '../ipc'
import { hostState } from '../state'

const taskOptions = computed(() => {
  return (hostState.value.interfaceJson?.task ?? []).map((info, index) => {
    return {
      value: info.name,
      label: info.name
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
  <n-card title="任务" size="small">
    <template #header-extra>
      <n-popselect
        trigger="hover"
        :options="taskOptions"
        @update:value="addTask"
        size="small"
        scrollable
      >
        <n-button size="small"> 添加 </n-button>
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
