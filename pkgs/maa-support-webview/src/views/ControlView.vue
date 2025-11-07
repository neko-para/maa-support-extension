<script setup lang="ts">
import { NSelect } from 'naive-ui'
import { computed } from 'vue'

import { controlViewState, globalState, localState } from '../states/config'
import { request } from '../utils/api'

const options = computed(() => {
  return (
    controlViewState.value.interface?.map(info => ({
      label: info,
      value: info
    })) ?? []
  )
})

function changeInterface(value: string) {
  request('/root/selectPath', { path: value })
}
</script>

<template>
  Control!

  <n-select
    :options="options"
    :value="controlViewState.activeInterface"
    @update:value="changeInterface"
  ></n-select>

  <div>
    {{ globalState }}
  </div>
  <div>
    {{ localState }}
  </div>
  <div>
    {{ controlViewState }}
  </div>
</template>
