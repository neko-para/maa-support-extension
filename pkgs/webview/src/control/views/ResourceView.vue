<script setup lang="ts">
import { NButton, NCard, NFlex, NSelect } from 'naive-ui'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import { computed, ref } from 'vue'

import { ipc } from '../ipc'
import { hostState } from '../state'

const resourceOptions = computed(() => {
  return (hostState.value.interfaceJson?.resource ?? []).map((info, index) => {
    return {
      value: index,
      label: info.name
    } satisfies SelectMixedOption
  })
})

const currentResource = computed(() => {
  const curr = hostState.value.interfaceConfigJson?.resource
  const index = hostState.value.interfaceJson?.resource?.findIndex(info => info.name === curr) ?? -1
  return index === -1 ? null : index
})

function switchResource(index: number) {
  ipc.send({
    command: 'selectResource',
    index
  })
}
</script>

<template>
  <n-card title="资源" size="small">
    <n-select
      :options="resourceOptions"
      :value="currentResource"
      @update:value="switchResource"
      size="small"
    ></n-select>
  </n-card>
</template>
