<script setup lang="ts">
import { NButton, NCheckbox, NFlex, NPopover } from 'naive-ui'
import { computed } from 'vue'

import {
  type CheckboxOption,
  type OptionTrace,
  type TaskConfig,
  resolveOptionConfig
} from '@nekosu/maa-pipeline-manager/logic'

import { ipc } from '../ipc'
import LocaleText from './LocaleText.vue'
import TaskOptionHeader from './TaskOptionHeader.vue'

const props = defineProps<{
  task: TaskConfig
  opt: OptionTrace
  optMeta: CheckboxOption
}>()

const optValue = computed(() => {
  return resolveOptionConfig(props.task, props.opt.name, 'checkbox')
})

const defaultValue = computed(() => {
  return props.optMeta.default_case ?? []
})

const effectiveValue = computed(() => {
  return optValue.value ?? defaultValue.value
})

function revealCase(name: string) {
  ipc.send({
    command: 'revealInterface',
    dest: {
      type: 'case',
      option: props.opt.name,
      case: name
    }
  })
}

function configTask(name: string, value: boolean) {
  if (!props.task.__key) {
    return
  }
  const values = new Set(effectiveValue.value)
  if (value) {
    values.add(name)
  } else {
    values.delete(name)
  }
  ipc.send({
    command: 'configTask',
    key: props.task.__key,
    option: props.opt.name,
    value: [...values]
  })
}

function clearOption() {
  if (!props.task.__key) {
    return
  }
  ipc.send({
    command: 'configTask',
    key: props.task.__key,
    option: props.opt.name,
    value: undefined
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
              configTask(caseMeta.name, val)
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
