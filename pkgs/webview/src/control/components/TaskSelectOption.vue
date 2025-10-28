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
  return props.task.option?.[props.opt]?.default
})

const defaultValue = computed(() => {
  return props.optMeta.default_case ?? props.optMeta.cases?.[0].name
})

const effectiveValue = computed(() => {
  return optValue.value ?? defaultValue.value
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
  if (effectiveValue.value) {
    ipc.send({
      command: 'revealInterface',
      dest: {
        type: 'case',
        option: props.opt,
        case: effectiveValue.value
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
    name: 'default',
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
      optMeta.cases?.map(cs => ({
        value: cs.name,
        label: cs.name + (cs.description ? ` - ${cs.description}` : '')
      })) ?? []
    "
    :value="optValue ?? null"
    @update:value="
      value => {
        configTask(opt, value)
      }
    "
    :placeholder="defaultValue"
    size="small"
  ></n-select>
</template>
