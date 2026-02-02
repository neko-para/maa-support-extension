<script setup lang="ts">
import { NCard, NSelect } from 'naive-ui'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import { computed } from 'vue'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import { hostState } from '../state'

const filteredResource = computed(() => {
  const curr = hostState.value.interfaceConfigJson?.controller?.name ?? ''
  return (hostState.value.interfaceJson?.resource ?? []).filter(info => {
    if (curr === '$fixed') {
      return true
    }
    if (info.controller) {
      return info.controller.includes(curr)
    }
    return true
  })
})

const resourceOptions = computed(() => {
  return filteredResource.value.map((info, index) => {
    return {
      value: index,
      label: info.name
    } satisfies SelectMixedOption
  })
})

const currentResource = computed(() => {
  const curr = hostState.value.interfaceConfigJson?.resource
  const index = filteredResource.value.findIndex(info => info.name === curr) ?? -1
  return index === -1 ? null : index
})

function switchResource(index: number) {
  ipc.send({
    command: 'selectResource',
    name: filteredResource.value[index].name
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
