<script setup lang="ts">
import { NButton, NCard, NFlex, NPopselect } from 'naive-ui'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import { computed, ref } from 'vue'

import type { NativeSelectOption } from '@mse/types'

import { t } from '../../utils/locale'
import TaskCard from '../components/TaskCard.vue'
import { ipc } from '../ipc'
import { hostState } from '../state'
import { makeBrief } from '../utils'

const selectingTask = ref(false)

const allTasks = computed(() => {
  const currCtrl = hostState.value.interfaceConfigJson?.controller?.name ?? ''

  return (hostState.value.interfaceJson?.task ?? []).filter(info => {
    if (info.controller && currCtrl !== '$fixed' && !info.controller.includes(currCtrl)) {
      return false
    }
    if (
      info.resource &&
      !info.resource.includes(hostState.value.interfaceConfigJson?.resource ?? '')
    ) {
      return false
    }
    return true
  })
})

const taskOptions = computed(() => {
  return allTasks.value.map((info, index) => {
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

async function nativeSelectTask() {
  selectingTask.value = true

  const options = await Promise.all(
    allTasks.value.map(async (info, index) => {
      const label = info.label
        ? await ipc.call({
            command: 'translate',
            key: info.label
          })
        : ''
      const desc = info.description
        ? await ipc.call({
            command: 'translate',
            key: info.description
          })
        : ''
      return {
        value: info.name,
        title: info.name,
        desc: info.entry,
        subtitle: `${label}\n${desc}`
      } satisfies NativeSelectOption
    })
  )

  const choice = (await ipc.call({
    command: 'showSelect',
    options
  })) as string | null
  if (typeof choice === 'string') {
    addTask(choice)
  }
  selectingTask.value = false
}
</script>

<template>
  <n-card :title="t('maa.control.task.task')" size="small">
    <template #header-extra>
      <n-popselect
        :disabled="selectingTask"
        trigger="hover"
        :options="taskOptions"
        @update:value="addTask"
        size="small"
        scrollable
      >
        <n-button
          :loading="selectingTask"
          :disabled="selectingTask"
          size="small"
          @click="nativeSelectTask"
        >
          {{ t('maa.control.task.add-task') }}
        </n-button>
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
