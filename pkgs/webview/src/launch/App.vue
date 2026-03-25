<script setup lang="ts">
import { NConfigProvider } from 'naive-ui'

import { useTheme } from '../utils/theme'
import AnalyzerFrame from './components/AnalyzerFrame.vue'
import LaunchControlBar from './components/LaunchControlBar.vue'

const { loaded, theme, themeOverride } = useTheme('panel')
</script>

<template>
  <template v-if="loaded">
    <n-config-provider :theme="theme" :theme-overrides="themeOverride">
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
</style>
