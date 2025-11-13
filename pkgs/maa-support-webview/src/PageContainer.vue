<script setup lang="ts">
import { NFlex, NSplit, NTabPane, NTabs } from 'naive-ui'

import { es } from './utils/api'
import { activeTab, closePage, tabData } from './utils/tabs'
import ControlView from './views/ControlView.vue'
import LaunchView from './views/LaunchView.vue'
</script>

<template>
  <n-split :default-size="0.3">
    <template #1>
      <n-flex vertical>
        <control-view></control-view>
        {{ es ? '已连接' : '已断开' }}
      </n-flex>
    </template>
    <template #2>
      <n-tabs v-model:value="activeTab" type="card" closable @close="id => closePage(id)">
        <template v-for="info in tabData" :key="info.id">
          <n-tab-pane :name="info.id" :tab="info.type">
            <template v-if="info.type === 'launch'">
              <launch-view :id="info.id"></launch-view>
            </template>
          </n-tab-pane>
        </template>
      </n-tabs>
    </template>
  </n-split>
</template>
