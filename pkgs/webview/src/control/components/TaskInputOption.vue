<script setup lang="ts">
import { NButton, NFlex, NPopover } from 'naive-ui'

import type { InputOption, TaskConfig } from '@mse/types'

import LocaleText from './LocaleText.vue'
import TaskInputOptionItem from './TaskInputOptionItem.vue'
import type { OptionInfo } from './types'
import { revealOption } from './utils'

const props = defineProps<{
  task: TaskConfig
  opt: OptionInfo
  optMeta: InputOption
}>()
</script>

<template>
  <n-flex>
    <n-popover trigger="hover" :disabled="!optMeta.label && !optMeta.description">
      <template #trigger>
        <n-button @click="revealOption(opt.option)" text> {{ opt.option }} </n-button>
      </template>

      <locale-text :text="optMeta.label"></locale-text>
      <locale-text :text="optMeta.description"></locale-text>
    </n-popover>

    <n-button v-if="!!opt.intro" @click="revealOption(opt.intro)" text> @{{ opt.intro }} </n-button>
  </n-flex>
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
