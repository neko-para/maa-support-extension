<script setup lang="ts">
import { computed } from 'vue'

import {
  type InputOption,
  type OptionTrace,
  type TaskConfig,
  resolveOptionConfig
} from '@nekosu/maa-pipeline-manager/logic'

import TaskInputOptionItem from './TaskInputOptionItem.vue'
import TaskOptionHeader from './TaskOptionHeader.vue'

const props = defineProps<{
  task: TaskConfig
  opt: OptionTrace
  optMeta: InputOption
}>()

const fullConfig = computed(() => {
  return resolveOptionConfig(props.task, props.opt.name, 'input')
})
</script>

<template>
  <task-option-header :opt="opt" :opt-meta="optMeta"> </task-option-header>

  <template v-for="info in optMeta.inputs ?? []" :key="info.name">
    <task-input-option-item
      v-if="task.__key"
      :task-key="task.__key"
      :task="task"
      :opt="opt"
      :item="info"
      :full-config="fullConfig"
    ></task-input-option-item>
  </template>
</template>
