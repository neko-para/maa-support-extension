<script setup lang="ts">
import { NButton, NFlex, NPopover, NSelect } from 'naive-ui'
import { computed } from 'vue'

import type { SelectOption, TaskConfig } from '@mse/types'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import LocaleText from './LocaleText.vue'
import type { OptionInfo } from './types'
import { revealOption } from './utils'

const props = defineProps<{
  task: TaskConfig
  opt: OptionInfo
  optMeta: SelectOption
}>()

const optValue = computed(() => {
  return props.task.option?.[props.opt.option]?.default
})

const defaultValue = computed(() => {
  return props.optMeta.default_case ?? props.optMeta.cases?.[0]?.name
})

const effectiveValue = computed(() => {
  return optValue.value ?? defaultValue.value
})

const effectiveCase = computed(() => {
  return props.optMeta.cases?.find(cs => cs.name === effectiveValue.value)
})

function revealCase() {
  if (effectiveValue.value) {
    ipc.send({
      command: 'revealInterface',
      dest: {
        type: 'case',
        option: props.opt.option,
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

function clearOption() {
  if (!props.task.__vscKey) {
    return
  }

  ipc.send({
    command: 'configTask',
    key: props.task.__vscKey,
    option: props.opt.option,
    name: 'default'
  })
}
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
  </n-flex>
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
          configTask(opt.option, value)
        }
      "
      :placeholder="optValue !== undefined ? '' : defaultValue"
      size="small"
    ></n-select>
    <n-button :disabled="optValue === undefined" @click="clearOption" text> Reset </n-button>
  </n-flex>
</template>
