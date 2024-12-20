<script setup lang="ts">
import { VscButton, VscScrollable } from '@/components/VscEl'
import * as interfaceSt from '@/control/states/interface'
import * as runtimeSt from '@/control/states/runtime'
</script>

<template>
  <div class="flex flex-col gap-1 min-w-0">
    <div class="flex gap-1 items-center">
      <vsc-button
        :disabled="interfaceSt.freezed.value || !!runtimeSt.runtime.value[1]"
        @click="interfaceSt.launch"
      >
        启动
      </vsc-button>
      <span v-if="runtimeSt.runtime.value[1]">
        {{ runtimeSt.runtime.value[1] }}
      </span>
    </div>

    <vsc-scrollable style="max-height: 10rem">
      <pre>{{ JSON.stringify(runtimeSt.runtime.value[0], null, 2) }}</pre>
    </vsc-scrollable>
  </div>
</template>
