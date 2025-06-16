<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { NConfigProvider, NFlex } from 'naive-ui'

import { useTheme } from '@/utils/theme'

import ControllerView from './views/ControllerView.vue'
import InterfaceView from './views/InterfaceView.vue'
import ResourceView from './views/ResourceView.vue'

const { theme, themeOverride } = useTheme()

hljs.registerLanguage('json', json)
</script>

<template>
  <n-config-provider :theme="theme" :theme-overrides="themeOverride" :hljs="hljs">
    <n-flex vertical>
      <interface-view></interface-view>
      <resource-view></resource-view>
      <controller-view></controller-view>
    </n-flex>
  </n-config-provider>
</template>
