<script setup lang="ts">
import { NButton, NFlex, NPopover } from 'naive-ui'

import type { OptionBase } from '@mse/types'

import { ipc } from '../ipc'
import LocaleText from './LocaleText.vue'
import type { OptionInfo, OptionIntro } from './types'
import { revealOption } from './utils'

defineProps<{
  opt: OptionInfo
  optMeta: OptionBase
}>()

function revealIntro(intro: OptionIntro) {
  if (intro.type === 'global_option') {
    return
  }
  if (!intro.name) {
    return
  }
  switch (intro.type) {
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
        <n-button @click="revealOption(opt.option)" text> {{ opt.option }} </n-button>
      </template>

      <locale-text :text="optMeta.label"></locale-text>
      <locale-text :text="optMeta.description"></locale-text>
    </n-popover>

    <n-button @click="revealIntro(opt.intro)" text>
      {{ `${opt.intro.type}@${opt.intro.name}` }}
    </n-button>

    <slot></slot>
  </n-flex>
</template>
