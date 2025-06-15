<script setup lang="ts">
import { NConfigProvider } from 'naive-ui'

import { useTheme } from '@/utils/theme'

import InterfaceView from './views/InterfaceView.vue'
import ResourceView from './views/ResourceView.vue'

const { theme, themeOverride } = useTheme()
</script>

<template>
  <n-config-provider :theme="theme" :theme-overrides="themeOverride">
    <interface-view></interface-view>
    <resource-view></resource-view>
  </n-config-provider>
</template>
