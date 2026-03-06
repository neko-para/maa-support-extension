<script setup lang="ts">
import type { TaskConfig } from '@mse/types'
import type { InputOption } from '@nekosu/maa-pipeline-manager/logic'

import TaskInputOptionItem from './TaskInputOptionItem.vue'
import TaskOptionHeader from './TaskOptionHeader.vue'
import type { OptionInfo } from './types'

defineProps<{
  task: TaskConfig
  opt: OptionInfo
  optMeta: InputOption
}>()
</script>

<template>
  <task-option-header :opt="opt" :opt-meta="optMeta"> </task-option-header>

  <template v-for="info in optMeta.inputs ?? []" :key="info.name">
    <task-input-option-item
      v-if="task.__vscKey"
      :task-key="task.__vscKey"
      :task="task"
      :opt="opt.option"
      :item="info"
    ></task-input-option-item>
  </template>
</template>
