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
    <div class="grid-form">
      <span class="fixed">配置</span>
      <v-interface></v-interface>

      <span class="fixed">资源</span>
      <v-resource></v-resource>

      <span class="fixed">控制</span>
      <v-controller></v-controller>

      <span class="fixed">任务</span>
      <v-task></v-task>

      <span class="fixed">执行</span>
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
