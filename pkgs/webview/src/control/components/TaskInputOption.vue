<script setup lang="ts">
import { NButton, NFlex, NInput } from 'naive-ui'
import { computed } from 'vue'

import type { InputOption, TaskConfig } from '@mse/types'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'

const props = defineProps<{
  task: TaskConfig
  opt: string
  optMeta: InputOption
}>()

const optValue = computed(() => {
  const val = props.task.option?.find(info => info.name === props.opt)?.value
  if (typeof val === 'string') {
    return {}
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

function configTask(option: string, key: string, value: string) {
  if (!props.task.__vscKey) {
    return
  }
  ipc.send({
    command: 'configTask',
    key: props.task.__vscKey,
    option,
    value: {
      ...optValue.value,
      [key]: value
    }
  })
}
</script>

<template>
  <n-flex>
    <n-button @click="revealOption()" text> {{ opt }} </n-button>
  </n-flex>
  <n-flex vertical>
    <template v-for="info in optMeta.input" :key="info.name">
      <span> {{ info.name }} </span>
      <n-input
        :value="optValue?.[info.name] ?? null"
        @update:value="
          value => {
            configTask(opt, info.name, value)
          }
        "
        :placeholder="info.default"
        size="small"
      ></n-input>
    </template>
  </n-flex>
</template>
