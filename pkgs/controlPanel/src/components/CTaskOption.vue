<script setup lang="ts">
import { computed } from 'vue'

import { VscButton, VscSingleSelect, type VscSingleSelectOption } from '@/components/VscEl'
import { ipc } from '@/main'
import * as interfaceSt from '@/states/interface'

const props = defineProps<{
  taskIndex: number
  option: string
}>()

const task = computed(() => {
  return interfaceSt.currentConfigObj.value.task?.[props.taskIndex]!
})

const optionProto = interfaceSt.currentObj.value.option?.[props.option]!

const optionOptions = computed<VscSingleSelectOption[]>(() => {
  return optionProto.cases.map(i => {
    return {
      value: i.name
    } satisfies VscSingleSelectOption
  })
})

const value = computed<string | undefined>({
  set(v?: string) {
    if (v) {
      if (!task.value.option) {
        task.value.option = [
          {
            name: props.option,
            value: v
          }
        ]
      } else {
        const entry = task.value.option.find(x => x.name === props.option)
        if (entry) {
          entry.value = v
        } else {
          task.value.option.push({
            name: props.option,
            value: v
          })
        }
      }
    }
  },
  get() {
    const choice = task.value.option?.find(x => x.name === props.option)
    return choice?.value ?? optionProto.default_case ?? optionProto.cases[0].name
  }
})

function revealOption() {
  ipc.postMessage({
    cmd: 'revealInterfaceAt',
    dest: {
      type: 'option',
      option: props.option
    }
  })
}

function revealCase() {
  ipc.postMessage({
    cmd: 'revealInterfaceAt',
    dest: {
      type: 'option',
      option: props.option,
      case: value.value
    }
  })
}
</script>

<template>
  <template v-if="task && optionProto">
    <div class="col-flex">
      <div class="row-flex">
        <span>{{ option }}</span>
        <vscode-icon name="search" @click="revealOption" :title="`查看 ${option}`"></vscode-icon>
        <vscode-icon
          v-if="value"
          name="search"
          @click="revealCase"
          :title="`查看 ${option} - ${value}`"
        ></vscode-icon>
      </div>
      <vsc-single-select
        v-model="value"
        :options="optionOptions"
        :disabled="interfaceSt.freezed.value"
      ></vsc-single-select>
    </div>
  </template>
</template>
