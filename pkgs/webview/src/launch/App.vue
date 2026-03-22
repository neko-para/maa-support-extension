<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { NConfigProvider } from 'naive-ui'

import { useTheme } from '../utils/theme'
import AnalyzerFrame from './components/AnalyzerFrame.vue'
import LaunchControlBar from './components/LaunchControlBar.vue'

const { loaded, theme, themeOverride } = useTheme('panel')

hljs.registerLanguage('json', json)
</script>

<template>
  <template v-if="loaded">
    <n-config-provider :theme="theme" :theme-overrides="themeOverride" :hljs="hljs">
      <div class="launch-root">
        <launch-control-bar>
          <analyzer-frame></analyzer-frame>
        </launch-control-bar>
      </div>
    </n-config-provider>
  </template>
</template>

<style scoped>
.launch-root {
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.launch-analyzer {
  flex: 1;
  min-height: 0;
}
</style>
