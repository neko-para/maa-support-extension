<script setup lang="ts">
import { NCard, NSelect } from 'naive-ui'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import { computed } from 'vue'

import { controlViewState, localState } from '../states/config'
import { request } from '../utils/api'
import { t } from '../utils/locale'

const resourceOptions = computed(() => {
  return (controlViewState.value.interfaceJson?.resource ?? [])
    .filter(info => {
      if (info.controller) {
        return info.controller.includes(localState.value.interfaceConfig?.controller?.name ?? '')
      }
      return true
    })
    .map((info, index) => {
      return {
        value: index,
        label: info.name
      } satisfies SelectMixedOption
    })
})

const currentResource = computed(() => {
  const curr = localState.value.interfaceConfig?.resource
  const index =
    controlViewState.value.interfaceJson?.resource?.findIndex(info => info.name === curr) ?? -1
  return index === -1 ? null : index
})

function switchResource(index: number) {
  request('/interface/selectResource', {
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
