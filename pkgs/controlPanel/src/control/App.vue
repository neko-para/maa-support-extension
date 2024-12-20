<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

import { VscButton, VscDivider, VscScrollable } from '@/components/VscEl'

import { ipc } from './main'
import VController from './views/VController.vue'
import VInterface from './views/VInterface.vue'
import VResource from './views/VResource.vue'
import VRuntime from './views/VRuntime.vue'
import VTask from './views/VTask.vue'

onMounted(() => {
  ipc.log.info('controlPanel awake')
  ipc.postAwake()
})
</script>

<template>
  <div id="root">
    <div class="mse-grid-form">
      <span class="mse-fixed-label">配置</span>
      <v-interface></v-interface>

      <span class="mse-fixed-label">资源</span>
      <v-resource></v-resource>

      <span class="mse-fixed-label">控制</span>
      <v-controller></v-controller>

      <span class="mse-fixed-label">任务</span>
      <v-task></v-task>

      <span class="mse-fixed-label">执行</span>
      <v-runtime></v-runtime>
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
