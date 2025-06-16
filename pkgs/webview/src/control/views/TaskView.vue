<script setup lang="ts">
import { NButton, NCard, NCollapse, NDropdown, NFlex, NTree, type TreeOption } from 'naive-ui'
import type { DropdownMixedOption } from 'naive-ui/es/dropdown/src/interface'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import { computed, ref } from 'vue'

import TaskCard from '../components/TaskCard.vue'
import { ipc } from '../ipc'
import { hostState } from '../state'

const taskOptions = computed(() => {
  return (hostState.value.interfaceJson?.task ?? []).map((info, index) => {
    return {
      key: info.name,
      label: info.name
    } satisfies DropdownMixedOption
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
      <n-dropdown trigger="hover" :options="taskOptions" @select="addTask" size="small">
        <n-button size="small"> 添加 </n-button>
      </n-dropdown>
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
