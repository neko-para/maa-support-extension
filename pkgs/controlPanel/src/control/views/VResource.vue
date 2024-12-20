<script setup lang="ts">
import { computed } from 'vue'

import { VscSingleSelect, type VscSingleSelectOption } from '@/components/VscEl'
import * as interfaceSt from '@/control/states/interface'
import * as resourceSt from '@/control/states/resource'

const resourceOptions = computed<VscSingleSelectOption[]>(() => {
  return (
    interfaceSt.currentObj.value.resource?.map(i => {
      return {
        value: i.name,
        description: `${i.path}`
      } satisfies VscSingleSelectOption
    }) ?? []
  )
})
</script>

<template>
  <div class="flex flex-col gap-1 min-w-0">
    <vsc-single-select
      v-model="resourceSt.currentName.value"
      :options="resourceOptions"
      :disabled="interfaceSt.freezed.value"
    ></vsc-single-select>
  </div>
</template>
