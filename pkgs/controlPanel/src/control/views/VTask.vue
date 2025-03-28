<script setup lang="tsx">
import { computed } from 'vue'

import {
  VscButton,
  VscCollapsible,
  VscSingleSelect,
  type VscSingleSelectOption
} from '@/components/VscEl'
import CTaskPanel from '@/control/components/CTaskPanel.vue'
import { ipc } from '@/control/main'
import * as interfaceSt from '@/control/states/interface'
import * as taskSt from '@/control/states/task'

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

function revealEntry(entry: string) {
  ipc.postMessage({
    cmd: 'revealInterfaceAt',
    dest: {
      type: 'entry',
      entry
    }
  })
}
</script>

<template>
  <div class="flex flex-col gap-1 min-w-0">
    <div class="flex gap-1 items-center">
      <vsc-single-select
        v-model="taskSt.addTaskName.value"
        :options="taskAddOptions"
        :disabled="interfaceSt.freezed.value"
      >
      </vsc-single-select>
      <vsc-button :disabled="interfaceSt.freezed.value" @click="taskSt.add"> 添加 </vsc-button>
    </div>
    <div
      v-if="interfaceSt.currentConfigObj.value.task?.length"
      class="flex flex-col gap-1 min-w-0"
      style="gap: 0"
    >
      <vsc-collapsible
        v-for="(task, k) in interfaceSt.currentConfigObj.value.task"
        :key="k"
        :title="task.name"
        v-model:open="task.__vscExpand"
        style="max-width: 20rem"
      >
        <template #decorations>
          <vscode-icon
            name="go-to-file"
            @click.stop="revealEntry(task.name)"
            action-icon
            :title="`查看 ${task.name}`"
          ></vscode-icon>
          <vscode-icon
            name="arrow-down"
            :disabled="
              k === (interfaceSt.currentConfigObj.value.task?.length ?? 0) - 1 ||
              interfaceSt.freezed.value
                ? ''
                : undefined
            "
            @click.stop="taskSt.move(k, 'down')"
            action-icon
          ></vscode-icon>
          <vscode-icon
            name="arrow-up"
            :disabled="k === 0 || interfaceSt.freezed.value ? '' : undefined"
            @click.stop="taskSt.move(k, 'up')"
            action-icon
          ></vscode-icon>
          <vscode-icon
            name="close"
            :disabled="interfaceSt.freezed.value ? '' : undefined"
            @click.stop="taskSt.del(k)"
            action-icon
          ></vscode-icon>
        </template>

        <c-task-panel :task-index="k"></c-task-panel>
      </vsc-collapsible>
    </div>
  </div>
</template>
