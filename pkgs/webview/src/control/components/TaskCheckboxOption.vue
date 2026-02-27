<script setup lang="ts">
import { NButton, NCheckbox, NFlex, NPopover } from 'naive-ui'
import { computed } from 'vue'

import type { CheckboxOption, TaskConfig } from '@mse/types'

import { ipc } from '../ipc'
import LocaleText from './LocaleText.vue'
import TaskOptionHeader from './TaskOptionHeader.vue'
import type { OptionInfo } from './types'

const props = defineProps<{
  task: TaskConfig
  opt: OptionInfo
  optMeta: CheckboxOption
}>()

const optValue = computed(() => {
  const val = props.task.option?.[props.opt.option]
  return val ? Object.keys(val) : undefined
})

const defaultValue = computed(() => {
  return props.optMeta.default_case ?? []
})

const effectiveValue = computed(() => {
  return optValue.value ?? defaultValue.value
})

function revealCase(name: string) {
  if (effectiveValue.value) {
    ipc.send({
      command: 'revealInterface',
      dest: {
        type: 'case',
        option: props.opt.option,
        case: name
      }
    })
  }
}

function configTask(option: string, name: string, value: string | undefined) {
  if (!props.task.__vscKey) {
    return
  }
  ipc.send({
    command: 'configTask',
    key: props.task.__vscKey,
    option,
    name,
    value
  })
}

function clearOption() {
  if (!props.task.__vscKey) {
    return
  }

  ipc.send({
    command: 'clearOption',
    key: props.task.__vscKey,
    option: props.opt.option
  })
}
</script>

<template>
  <task-option-header :opt="opt" :opt-meta="optMeta"> </task-option-header>

  <n-flex align="center">
    <n-flex align="center">
      <template v-for="caseMeta in optMeta.cases" :key="caseMeta.name">
        <n-checkbox
          :checked="effectiveValue.includes(caseMeta.name)"
          @update:checked="
            val => {
              configTask(opt.option, caseMeta.name, val ? '' : undefined)
            }
          "
        >
        </n-checkbox>

        <n-popover trigger="hover" :disabled="!caseMeta.label && !caseMeta.description">
          <template #trigger>
            <n-button @click="revealCase(caseMeta.name)" text> {{ caseMeta.name }} </n-button>
          </template>

          <locale-text :text="caseMeta.label"></locale-text>
          <locale-text :text="caseMeta.description"></locale-text>
        </n-popover>
      </template>
    </n-flex>

    <n-button :disabled="optValue === undefined" @click="clearOption" text> Reset </n-button>
  </n-flex>
</template>
