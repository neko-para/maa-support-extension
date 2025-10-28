<script setup lang="ts">
import { NButton, NFlex, NInput, NPopover } from 'naive-ui'
import { compile, computed, ref } from 'vue'

import type { InputItem, InputOption, TaskConfig } from '@mse/types'

import { ipc } from '../ipc'

const props = defineProps<{
  taskKey: string
  task: TaskConfig
  opt: string
  item: InputItem
}>()

const optValue = computed(() => {
  return props.task.option?.[props.opt]?.[props.item.name]
})

const defaultValue = computed(() => {
  return props.item.default
})

const effectiveValue = computed(() => {
  return optValue.value ?? defaultValue.value
})

const cache = ref<string | null>(null)

let timer: number | null = null
let flushTimer: number | null = null

const inputValue = computed<string | null>({
  get() {
    return cache.value ?? optValue.value ?? null
  },
  set(v) {
    if (v === null) {
      return
    }

    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (flushTimer !== null) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    cache.value = v
    timer = setTimeout(() => {
      timer = null
      ipc.send({
        command: 'configTask',
        key: props.taskKey,
        option: props.opt,
        name: props.item.name,
        value: v
      })
      flushTimer = setTimeout(() => {
        flushTimer = null
        cache.value = null
      }, 500) as unknown as number
    }, 500) as unknown as number
  }
})

function clearOption() {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }

  cache.value = null
  ipc.send({
    command: 'configTask',
    key: props.taskKey,
    option: props.opt,
    name: props.item.name
  })
}

function revealInput(name: string) {
  ipc.send({
    command: 'revealInterface',
    dest: {
      type: 'input',
      option: props.opt,
      name
    }
  })
}

const verifyReg = computed(() => {
  if (props.item.verify) {
    try {
      return new RegExp(props.item.verify)
    } catch {
      return null
    }
  }
  return null
})

const status = computed<undefined | 'error'>(() => {
  if (!verifyReg.value) {
    return undefined
  }
  return verifyReg.value.test(effectiveValue.value ?? '') ? undefined : 'error'
})
</script>

<template>
  <n-flex>
    <n-popover trigger="hover" :disabled="!item.description">
      <template #trigger>
        <n-button @click="revealInput(item.name)" text> {{ item.name }} </n-button>
      </template>

      <span> {{ item.description }} </span>
    </n-popover>
  </n-flex>
  <n-flex :wrap="false">
    <n-input
      v-model:value="inputValue"
      :placeholder="optValue !== undefined ? '' : defaultValue"
      :status="status"
      size="small"
    ></n-input>
    <n-button :disabled="optValue === undefined" @click="clearOption" text> Reset </n-button>
  </n-flex>
</template>
