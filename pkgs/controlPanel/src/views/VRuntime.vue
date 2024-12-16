<script setup lang="ts">
import { VscButton, VscScrollable } from '@/components/VscEl'
import * as interfaceSt from '@/states/interface'
import * as runtimeSt from '@/states/runtime'
</script>

<template>
  <div class="col-flex">
    <div class="row-flex">
      <vsc-button
        v-if="!interfaceSt.launching.value"
        :disabled="interfaceSt.freezed.value || !!runtimeSt.runtime.value[1]"
        @click="interfaceSt.launch"
      >
        启动
      </vsc-button>
      <vsc-button v-if="interfaceSt.launching.value" @click="interfaceSt.stop"> 停止 </vsc-button>
      <vscode-icon v-if="interfaceSt.launching.value" name="loading" spin></vscode-icon>
      <span v-if="runtimeSt.runtime.value[1]">
        {{ runtimeSt.runtime.value[1] }}
      </span>
    </div>

    <vsc-scrollable style="max-height: 10rem">
      <pre>{{ JSON.stringify(runtimeSt.runtime.value[0], null, 2) }}</pre>
    </vsc-scrollable>
  </div>
</template>
