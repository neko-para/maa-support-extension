<script setup lang="tsx">
import { computed } from 'vue'

import CTaskPanel from '@/components/CTaskPanel.vue'
import {
  VscButton,
  VscCollapsible,
  VscSingleSelect,
  type VscSingleSelectOption
} from '@/components/VscEl'
import * as interfaceSt from '@/states/interface'
import * as taskSt from '@/states/task'

const taskAddOptions = computed<VscSingleSelectOption[]>(() => {
  return (
    interfaceSt.currentObj.value.task?.map(i => {
      return {
        value: i.name,
        description: `${i.entry}`
      } satisfies VscSingleSelectOption
    }) ?? []
  )
})
</script>

<template>
  <div class="col-flex">
    <div class="row-flex">
      <vsc-single-select
        v-model="taskSt.addTaskName.value"
        :options="taskAddOptions"
        :disabled="interfaceSt.freezed.value"
      >
      </vsc-single-select>
      <vsc-button :disabled="interfaceSt.freezed.value" @click="taskSt.add"> 添加 </vsc-button>
    </div>
    <div v-if="interfaceSt.currentConfigObj.value.task?.length" class="col-flex" style="gap: 0">
      <vsc-collapsible
        v-for="(task, k) in interfaceSt.currentConfigObj.value.task"
        :key="k"
        :title="task.name"
        v-model:open="task.__vscExpand"
        style="max-width: 20rem"
      >
        <template #decorations>
          <vscode-icon
            name="arrow-down"
            :disabled="
              k === (interfaceSt.currentConfigObj.value.task?.length ?? 0) - 1 ||
              interfaceSt.freezed.value
                ? ''
                : undefined
            "
            @click.stop="taskSt.move(k, 'down')"
          ></vscode-icon>
          <vscode-icon
            name="arrow-up"
            :disabled="k === 0 || interfaceSt.freezed.value ? '' : undefined"
            @click.stop="taskSt.move(k, 'up')"
          ></vscode-icon>
          <vscode-icon
            name="close"
            @click.stop="taskSt.del(k)"
            :disabled="interfaceSt.freezed.value ? '' : undefined"
          ></vscode-icon>
        </template>

        <c-task-panel :task-index="k"></c-task-panel>
      </vsc-collapsible>
    </div>
  </div>
</template>
