<script setup lang="ts">
import { NButton, NFlex, NPopover, NSwitch } from 'naive-ui'
import { computed } from 'vue'

import type { SwitchOption, TaskConfig } from '@mse/types'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'

const props = defineProps<{
  task: TaskConfig
  opt: string
  optMeta: SwitchOption
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

const effectiveCase = computed(() => {
  return props.optMeta.cases?.find(cs => cs.name === effectiveValue.value)
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

function clearOption() {
  if (!props.task.__vscKey) {
    return
  }

  ipc.send({
    command: 'configTask',
    key: props.task.__vscKey,
    option: props.opt,
    name: 'default'
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

    <n-popover v-if="effectiveCase" trigger="hover" :disabled="!effectiveCase.description">
      <template #trigger>
        <n-button @click="revealCase()" text>
          {{ t('maa.control.task.current-case') }}
        </n-button>
      </template>

      <div v-html="effectiveCase.description"></div>
    </n-popover>
  </n-flex>
  <n-flex :wrap="false" align="center">
    <n-switch
      :value="(optValue ?? defaultValue) === 'Yes'"
      @update:value="
        value => {
          configTask(opt, value ? 'Yes' : 'No')
        }
      "
    ></n-switch>
    <n-button :disabled="optValue === undefined" @click="clearOption" text> Reset </n-button>
  </n-flex>
</template>
