<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { NConfigProvider, NFlex, NSplit, NTabs } from 'naive-ui'
import { ref } from 'vue'

import { es } from './utils/api'
import { isVscode, viewRole } from './utils/config'
import { useTheme } from './utils/theme'
import ControlView from './views/ControlView.vue'

const { loaded, theme, themeOverride } = useTheme()

hljs.registerLanguage('json', json)
</script>

<template>
  <template v-if="!isVscode || loaded">
    <n-config-provider :theme="theme" :theme-overrides="themeOverride" :hljs="hljs" abstract>
      <template v-if="viewRole === 'control'">
        <control-view></control-view>
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
            <n-tabs type="card" closable addable> </n-tabs>
          </template>
        </n-split>
      </template>
    </n-config-provider>
  </template>
</template>
