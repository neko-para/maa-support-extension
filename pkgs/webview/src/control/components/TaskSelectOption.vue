<script setup lang="ts">
import { NButton, NFlex, NSelect } from 'naive-ui'
import { computed } from 'vue'

import type { SelectOption, TaskConfig } from '@mse/types'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'

const props = defineProps<{
  task: TaskConfig
  opt: string
  optMeta: SelectOption
}>()

const optValue = computed(() => {
  const val = props.task.option?.find(info => info.name === props.opt)?.value
  if (typeof val === 'object') {
    return undefined
  } else {
    return val
  }
})

function revealOption() {
  ipc.send({
    command: 'revealInterface',
    dest: {
      type: 'option',
      option: props.opt
    }
  })
}

function revealCase() {
  const value = optValue.value ?? props.optMeta.default_case ?? props.optMeta.cases[0].name
  if (value) {
    ipc.send({
      command: 'revealInterface',
      dest: {
        type: 'case',
        option: props.opt,
        case: value
      }
    })
  }
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
  <n-flex>
    <n-button @click="revealOption()" text> {{ opt }} </n-button>
    <n-button @click="revealCase()" text>
      {{ t('maa.control.task.current-case') }}
    </n-button>
  </n-flex>
  <n-select
    :options="
      optMeta.cases.map(cs => ({
        value: cs.name,
        label: cs.name
      }))
    "
    :value="optValue ?? null"
    @update:value="
      value => {
        configTask(opt, value)
      }
    "
    :placeholder="optMeta.default_case ?? optMeta.cases[0].name"
    size="small"
  ></n-select>
</template>
