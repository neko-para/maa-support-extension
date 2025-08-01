<script setup lang="ts">
import { type AutoCompleteOption, NAutoComplete } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'

import { t } from '../../utils/locale'
import { hostState } from '../state'

const inputTask = ref('')

const taskOptions = computed(() => {
  if (inputTask.value === ' ') {
    return (hostState.value.knownTasks ?? []).map((info, index) => {
      return {
        value: info,
        label: ' ' + info
      } satisfies AutoCompleteOption
    })
  } else {
    return (hostState.value.knownTasks ?? [])
      .map((info, index) => {
        return {
          value: info,
          label: info
        } satisfies AutoCompleteOption
      })
      .filter(x => x.value.startsWith(inputTask.value))
  }
})

const inputEl = ref<InstanceType<typeof NAutoComplete> | null>(null)

const emits = defineEmits<{
  submit: [task: string]
  deactivate: []
}>()

function onBlur() {
  if (inputTask.value && inputTask.value !== ' ') {
    emits('submit', inputTask.value)
  } else {
    emits('deactivate')
  }
}

function onSelect(task: string) {
  emits('submit', task)
}

onMounted(() => {
  inputEl.value?.focus()
})
</script>

<template>
  <n-auto-complete
    ref="inputEl"
    v-model:value="inputTask"
    :options="taskOptions"
    @blur="onBlur"
    @select="onSelect"
    size="small"
    :placeholder="t('maa.launch.input-space-to-show-tasks')"
    style="min-width: 16rem"
  ></n-auto-complete>
</template>
