<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { NCard, NConfigProvider, NSplit } from 'naive-ui'
import { ref } from 'vue'

import { useTheme } from '../utils/theme'
import StatusView from './views/StatusView.vue'

const { theme, themeOverride } = useTheme('panel')

hljs.registerLanguage('json', json)

const splitSize = ref(0.6)
</script>

<template>
  <n-config-provider :theme="theme" :theme-overrides="themeOverride" :hljs="hljs">
    <n-split v-model:size="splitSize" :max="0.8" :min="0.6" style="height: 100vh">
      <template #1>
        <status-view></status-view>
      </template>
      <template #2>
        <n-card title="详情"></n-card>
      </template>
    </n-split>
  </n-config-provider>
</template>
