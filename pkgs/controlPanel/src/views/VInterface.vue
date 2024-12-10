<script setup lang="ts">
import { computed } from 'vue'

import { VscButton, VscSingleSelect, type VscSingleSelectOption } from '@/components/VscEl'
import { ipc } from '@/main'
import * as interfaceSt from '@/states/interface'

const interfaceOptions = computed<VscSingleSelectOption[]>(() => {
  return interfaceSt.list.value.map(i => {
    return {
      value: i
    }
  })
})
</script>

<template>
  <div class="col-flex">
    <div class="row-flex">
      <div class="col-flex">
        <vsc-single-select
          v-model="interfaceSt.currentName.value"
          :options="interfaceOptions"
          :disabled="interfaceSt.freezed.value"
        ></vsc-single-select>
      </div>
      <vsc-button
        :loading="ipc.context.value.interfaceRefreshing"
        :disabled="interfaceSt.freezed.value"
        @click="interfaceSt.refresh"
      >
        刷新
      </vsc-button>
    </div>
  </div>
</template>
