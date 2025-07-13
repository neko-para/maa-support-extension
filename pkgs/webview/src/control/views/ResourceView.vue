<script setup lang="ts">
import { NCard, NSelect } from 'naive-ui'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import { computed } from 'vue'

import { t } from '../../utils/locale'
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
  <n-card :title="t('maa.control.resource.resource')" size="small">
    <n-select
      :options="resourceOptions"
      :value="currentResource"
      @update:value="switchResource"
      :placeholder="t('maa.control.resource.select-resource')"
      size="small"
    ></n-select>
  </n-card>
</template>
