<script setup lang="ts">
import { NButton, NFlex, NPopover, NSelect } from 'naive-ui'
import { computed } from 'vue'

import {
  type OptionTrace,
  type SelectOption,
  type TaskConfig,
  resolveOptionConfig,
  resolveSelect
} from '@nekosu/maa-pipeline-manager/logic'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import LocaleText from './LocaleText.vue'
import TaskOptionHeader from './TaskOptionHeader.vue'

const props = defineProps<{
  task: TaskConfig
  opt: OptionTrace
  optMeta: SelectOption
}>()

const optValue = computed(() => {
  return resolveOptionConfig(props.task, props.opt.name, 'select')
})

const defaultValue = computed(() => {
  return props.optMeta.default_case ?? props.optMeta.cases?.[0]?.name
})

const effectiveCase = computed(() => {
  return resolveSelect(props.task, props.opt.name, props.optMeta)
})

function revealCase() {
  if (effectiveCase.value) {
    ipc.send({
      command: 'revealInterface',
      dest: {
        type: 'case',
        option: props.opt.name,
        case: effectiveCase.value.name
      }
    })
  }
}

function configTask(value: string) {
  if (!props.task.__key) {
    return
  }
  ipc.send({
    command: 'configTask',
    key: props.task.__key,
    option: props.opt.name,
    value
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
  <task-option-header :opt="opt" :opt-meta="optMeta">
    <n-popover
      v-if="effectiveCase"
      trigger="hover"
      :disabled="!effectiveCase.label && !effectiveCase.description"
    >
      <template #trigger>
        <n-button @click="revealCase()" text>
          {{ t('maa.control.task.current-case') }}
        </n-button>
      </template>

      <locale-text :text="effectiveCase.label"></locale-text>
      <locale-text :text="effectiveCase.description"></locale-text>
    </n-popover>
  </task-option-header>

  <n-flex :wrap="false">
    <n-select
      :options="
        optMeta.cases?.map(cs => ({
          value: cs.name,
          label: cs.name
        })) ?? []
      "
      :value="optValue ?? null"
      @update:value="
        value => {
          configTask(value)
        }
      "
      :placeholder="optValue !== undefined ? '' : defaultValue"
      size="small"
    ></n-select>
    <n-button :disabled="optValue === undefined" @click="clearOption" text> Reset </n-button>
  </n-flex>
</template>
