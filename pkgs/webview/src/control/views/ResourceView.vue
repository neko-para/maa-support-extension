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

function switchResource(path: string) {
  // ipc.send({
  //   command: 'selectInterface',
  //   path
  // })
}
</script>

<template>
  <n-card title="资源" size="small">
    <n-select
      :options="resourceOptions"
      :value="hostState.interfaceConfigJson?.resource"
      @update:value="switchResource"
    ></n-select>
  </n-card>
</template>
