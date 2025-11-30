<script setup lang="ts">
import { NButton, NFlex, NPopover } from 'naive-ui'

import type { InputOption, TaskConfig } from '@mse/types'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import TaskInputOptionItem from './TaskInputOptionItem.vue'

const props = defineProps<{
  task: TaskConfig
  opt: string
  optMeta: InputOption
}>()

function revealOption() {
  ipc.send({
    command: 'revealInterface',
    dest: {
      type: 'option',
      option: props.opt
    }
  })
}
</script>

<template>
  <n-flex>
    <n-popover trigger="hover" :disabled="!optMeta.description">
      <template #trigger>
        <n-button @click="revealOption()" text> {{ opt }} </n-button>
      </template>

      <div v-html="optMeta.description"></div>
    </n-popover>
  </n-flex>
  <template v-for="info in optMeta.inputs ?? []" :key="info.name">
    <task-input-option-item
      v-if="task.__vscKey"
      :task-key="task.__vscKey"
      :task="task"
      :opt="opt"
      :item="info"
    ></task-input-option-item>
  </template>
</template>
