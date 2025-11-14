<script setup lang="ts">
import { NFlex, NSplit, NTab, NTabPane, NTabs } from 'naive-ui'

import { es } from './utils/api'
import { activeTab, activeTabInfo, closePage, tabData } from './utils/tabs'
import ControlView from './views/ControlView.vue'
import LaunchView from './views/LaunchView.vue'
</script>

<template>
  <n-split :default-size="0.3" style="height: 100vh">
    <template #1>
      <n-flex vertical>
        <control-view></control-view>
        {{ es ? '已连接' : '已断开' }}
      </n-flex>
    </template>
    <template #2>
      <n-flex vertical style="height: 100vh">
        <n-tabs v-model:value="activeTab" type="card" closable @close="id => closePage(id)">
          <template v-for="info in tabData" :key="info.id">
            <n-tab :name="info.id" :tab="info.type"> </n-tab>
          </template>
        </n-tabs>
        <template v-if="activeTabInfo">
          <template v-if="activeTabInfo.type === 'launch'">
            <launch-view :id="activeTabInfo.id"></launch-view>
          </template>
        </template>
      </n-flex>
    </template>
  </n-split>
</template>
