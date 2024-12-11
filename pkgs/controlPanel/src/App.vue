<script setup lang="ts">
import { VscButton, VscDivider, VscScrollable } from '@/components/VscEl'
import * as interfaceSt from '@/states/interface'

import { ipc } from './main'
import VController from './views/VController.vue'
import VInterface from './views/VInterface.vue'
import VResource from './views/VResource.vue'
import VTask from './views/VTask.vue'
</script>

<template>
  <div id="root">
    <div class="grid-form" style="margin-top: 0.5rem">
      <span class="fixed">配置</span>
      <v-interface></v-interface>

      <span class="fixed">资源</span>
      <v-resource></v-resource>

      <span class="fixed">控制</span>
      <v-controller></v-controller>

      <span class="fixed">任务</span>
      <v-task></v-task>
    </div>
    <div class="row-flex">
      <vsc-button
        :loading="interfaceSt.launching.value"
        :disabled="interfaceSt.freezed.value"
        @click="interfaceSt.launch"
      >
        启动
      </vsc-button>
    </div>
    <vsc-divider></vsc-divider>
    <div>
      <vsc-button @click="ipc.context.value = {}"> Reset </vsc-button>
    </div>
    <vsc-scrollable>
      <pre>{{ JSON.stringify(ipc.context.value, null, 2) }}</pre>
    </vsc-scrollable>
  </div>
</template>

<style scoped>
#root {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  height: 100%;
  padding: 0 0.5rem;
}
</style>
