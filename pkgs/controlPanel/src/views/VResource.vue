<script setup lang="ts">
import { computed } from 'vue'

import { VscSingleSelect, type VscSingleSelectOption } from '@/components/VscEl'
import * as interfaceSt from '@/states/interface'
import * as resourceSt from '@/states/resource'

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
  <div class="col-flex">
    <vsc-single-select
      v-model="resourceSt.currentName.value"
      :options="resourceOptions"
      :disabled="interfaceSt.freezed.value"
    ></vsc-single-select>
  </div>
</template>
