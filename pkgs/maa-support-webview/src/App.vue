<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { NConfigProvider } from 'naive-ui'

import PageContainer from './PageContainer.vue'
import { isVscode, viewId, viewRole } from './utils/config'
import { useTheme } from './utils/theme'
import ControlView from './views/ControlView.vue'
import LaunchView from './views/LaunchView.vue'

const { loaded, theme, themeOverride } = useTheme()

hljs.registerLanguage('json', json)
</script>

<template>
  <template v-if="!isVscode || loaded">
    <n-config-provider :theme="theme" :theme-overrides="themeOverride" :hljs="hljs" abstract>
      <template v-if="isVscode">
        <template v-if="viewRole === 'control'">
          <control-view></control-view>
        </template>
        <template v-else-if="!viewId"> missing id! </template>
        <template v-else-if="viewRole === 'launch'">
          <launch-view :id="viewId"></launch-view>
        </template>
      </template>
      <template v-else>
        <page-container></page-container>
      </template>
    </n-config-provider>
  </template>
</template>
