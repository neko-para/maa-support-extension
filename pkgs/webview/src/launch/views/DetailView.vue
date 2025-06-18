<script setup lang="ts">
import { NCard, NCode, NFlex, NScrollbar } from 'naive-ui'

import JsonCode from '../../components/JsonCode.vue'
import { recoInfo } from '../states/reco'
</script>

<template>
  <n-scrollbar style="height: 100vh">
    <n-card title="详情" content-style="display: flex; flex-direction: column">
      <template v-if="recoInfo">
        <n-flex vertical>
          <json-code :code="JSON.stringify(recoInfo.info, null, 2)"></json-code>

          <img :src="recoInfo.raw" />
          <img v-for="(draw, idx) in recoInfo.draws" :key="idx" :src="draw" />
        </n-flex>
      </template>
    </n-card>
  </n-scrollbar>
</template>
