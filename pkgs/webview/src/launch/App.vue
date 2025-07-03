<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { NCard, NConfigProvider, NSplit } from 'naive-ui'
import { ref } from 'vue'

import { useTheme } from '../utils/theme'
import DetailView from './views/DetailView.vue'
import StatusView from './views/StatusView.vue'

const { loaded, theme, themeOverride } = useTheme('panel')

hljs.registerLanguage('json', json)

const splitSize = ref(0.6)
</script>

<template>
  <template v-if="loaded">
    <n-config-provider :theme="theme" :theme-overrides="themeOverride" :hljs="hljs">
      <n-split v-model:size="splitSize" :max="0.8" :min="0.6" style="height: 100vh">
        <template #1>
          <status-view></status-view>
        </template>
        <template #2>
          <detail-view></detail-view>
        </template>
      </n-split>
    </n-config-provider>
  </template>
</template>
