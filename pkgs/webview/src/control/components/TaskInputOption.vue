<script setup lang="ts">
import { NButton, NFlex, NInput } from 'naive-ui'
import { computed, ref } from 'vue'

import type { InputItem, InputOption, TaskConfig } from '@mse/types'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'

const props = defineProps<{
  task: TaskConfig
  opt: string
  optMeta: InputOption
}>()

const optValue = computed(() => {
  return props.task.option?.[props.opt] ?? {}
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

function validate(info: InputItem, value: string | undefined): undefined | 'error' {
  if (!info.verify) {
    return undefined
  }
  const re = new RegExp(info.verify)
  if (re.test(value ?? '')) {
    return undefined
  } else {
    return 'error'
  }
}

const inputCache = ref<Record<string, string | null>>({})

let prevKey: null | string = null
let prevConfig: null | (() => void) = null
let prevTimer: null | number = null

function flushDifferent(key: string) {
  if (prevKey !== null && prevKey !== key) {
    const oldKey = prevKey
    prevConfig?.()
    setTimeout(() => {
      delete inputCache.value[oldKey]
    }, 10)
  }
  if (prevTimer !== null) {
    clearTimeout(prevTimer)
  }

  prevKey = null
  prevConfig = null
  prevTimer = null
}

function configTask(option: string, key: string, value: string) {
  if (!props.task.__vscKey) {
    return
  }
  const taskKey = props.task.__vscKey

  flushDifferent(key)

  prevKey = key
  prevConfig = () => {
    ipc.send({
      command: 'configTask',
      key: taskKey,
      option,
      name: key,
      value
    })
    setTimeout(() => {
      delete inputCache.value[key]
    }, 10)
  }
  prevTimer = setTimeout(() => {
    prevConfig?.()

    prevKey = null
    prevConfig = null
    prevTimer = null
  }, 500) as unknown as number
  inputCache.value[key] = value
}

function configTaskRemove(option: string, key: string) {
  if (!props.task.__vscKey) {
    return
  }
  const taskKey = props.task.__vscKey

  flushDifferent(key)

  ipc.send({
    command: 'configTask',
    key: taskKey,
    option,
    name: key
  })
  setTimeout(() => {
    delete inputCache.value[key]
  }, 10)
}
</script>

<template>
  <n-flex>
    <n-button @click="revealOption()" text> {{ opt }} </n-button>
  </n-flex>
  <template v-for="info in optMeta.input ?? []" :key="info.name">
    <n-flex>
      <n-button @click="revealInput(info.name)" text> {{ info.name }} </n-button>
    </n-flex>
    <n-flex :wrap="false">
      <n-input
        :value="inputCache[info.name] ?? optValue?.[info.name] ?? null"
        :status="validate(info, optValue?.[info.name] ?? info.default)"
        @update:value="
          value => {
            configTask(opt, info.name, value)
          }
        "
        :placeholder="optValue?.[info.name] === undefined ? info.default : ''"
        size="small"
      ></n-input>
      <n-button
        v-if="optValue?.[info.name] !== undefined"
        @click="configTaskRemove(opt, info.name)"
        text
      >
        reset
      </n-button>
    </n-flex>
  </template>
</template>
