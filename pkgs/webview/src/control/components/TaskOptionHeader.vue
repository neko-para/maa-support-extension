<script setup lang="ts">
import { NButton, NFlex, NPopover } from 'naive-ui'

import type { OptionBase, OptionTrace } from '@nekosu/maa-pipeline-manager/logic'

import { ipc } from '../ipc'
import LocaleText from './LocaleText.vue'

defineProps<{
  opt: OptionTrace
  optMeta: OptionBase
}>()

function revealOption(option: string) {
  ipc.send({
    command: 'revealInterface',
    dest: {
      type: 'option',
      option: option
    }
  })
}

function revealIntro(intro: OptionTrace) {
  ipc.send({
    command: 'revealInterface',
    dest: {
      type: 'option_ref',
      trace: intro
    }
  })
}
</script>

<template>
  <n-flex>
    <n-popover trigger="hover" :disabled="!optMeta.label && !optMeta.description">
      <template #trigger>
        <n-button @click="revealOption(opt.name)" text> {{ opt.name }} </n-button>
      </template>

      <locale-text :text="optMeta.label"></locale-text>
      <locale-text :text="optMeta.description"></locale-text>
    </n-popover>

    <n-button @click="revealIntro(opt)" text>
      {{ `${opt.from}@${opt.origin}` }}
    </n-button>

    <slot></slot>
  </n-flex>
</template>
