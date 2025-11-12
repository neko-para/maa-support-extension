<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { NConfigProvider, NFlex, NSplit, NTabPane, NTabs } from 'naive-ui'
import { ref } from 'vue'

import { es } from './utils/api'
import { isVscode, viewId, viewRole } from './utils/config'
import { activeTab, closePage, tabData } from './utils/tabs'
import { useTheme } from './utils/theme'
import ControlView from './views/ControlView.vue'
import LaunchView from './views/LaunchView.vue'

const { loaded, theme, themeOverride } = useTheme()

hljs.registerLanguage('json', json)
</script>

<template>
  <template v-if="!isVscode || loaded">
    <n-config-provider :theme="theme" :theme-overrides="themeOverride" :hljs="hljs" abstract>
      <template v-if="viewRole === 'control'">
        <control-view></control-view>
      </template>
      <template v-else-if="viewRole === 'launch'">
        <template v-if="!viewId"> missing id! </template>
        <launch-view v-else :id="viewId"></launch-view>
      </template>
      <template v-else>
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
    </n-config-provider>
  </template>
</template>
