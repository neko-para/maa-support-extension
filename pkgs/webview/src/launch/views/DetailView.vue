<script setup lang="ts">
import { NCard, NFlex, NScrollbar, NText } from 'naive-ui'

import JsonCode from '../../components/JsonCode.vue'
import { recoInfo, taskInfo } from '../states/info'
</script>

<template>
  <n-scrollbar style="height: 100vh">
    <n-flex vertical>
      <n-card
        title="识别详情"
        content-style="display: flex; flex-direction: column"
        :closable="!!recoInfo"
        @close="recoInfo = null"
      >
        <template v-if="recoInfo">
          <n-flex vertical>
            <json-code :code="JSON.stringify(recoInfo.info, null, 2)"></json-code>

            <img :src="recoInfo.raw" />
            <img v-for="(draw, idx) in recoInfo.draws" :key="idx" :src="draw" />
          </n-flex>
        </template>
      </n-card>
      <n-card
        title="任务定义"
        content-style="display: flex; flex-direction: column"
        :closable="!!taskInfo"
        @close="taskInfo = null"
      >
        <template v-if="taskInfo">
          <n-flex vertical>
            <n-text> {{ taskInfo[0] }} </n-text>
            <json-code :code="taskInfo[1] ?? ''"></json-code>
          </n-flex>
        </template>
      </n-card>
    </n-flex>
  </n-scrollbar>
</template>
