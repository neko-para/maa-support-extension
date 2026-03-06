<script setup lang="ts">
import { NButton, NFlex, NPopover } from 'naive-ui'

import type { OptionBase, OptionTrace } from '@nekosu/maa-pipeline-manager/logic'

import { ipc } from '../ipc'
import LocaleText from './LocaleText.vue'
import { revealOption } from './utils'

defineProps<{
  opt: OptionTrace
  optMeta: OptionBase
}>()

function revealIntro(intro: OptionTrace) {
  if (intro.from === 'global') {
    return
  }
  if (!intro.name) {
    return
  }
  switch (intro.from) {
    case 'controller':
      ipc.send({
        command: 'revealInterface',
        dest: {
          type: 'controller',
          ctrl: intro.name
        }
      })
      break
    case 'resource':
      ipc.send({
        command: 'revealInterface',
        dest: {
          type: 'resource',
          res: intro.name
        }
      })
      break
    case 'task':
      ipc.send({
        command: 'revealInterface',
        dest: {
          type: 'task',
          task: intro.name
        }
      })
      break
    case 'option':
      revealOption(intro.name)
      break
  }
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
