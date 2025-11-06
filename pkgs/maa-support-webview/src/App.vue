<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { NCard, NConfigProvider, NSplit } from 'naive-ui'
import { ref } from 'vue'

import { isVscode, viewRole } from './utils/config'
import { useTheme } from './utils/theme'
import ControlView from './views/ControlView.vue'

const { loaded, theme, themeOverride } = useTheme()

hljs.registerLanguage('json', json)
</script>

<template>
  <template v-if="!isVscode || loaded">
    <n-config-provider :theme="theme" :theme-overrides="themeOverride" :hljs="hljs">
      <template v-if="viewRole === 'control'">
        <control-view></control-view>
      </template>
      <template v-else> not impl! </template>
    </n-config-provider>
  </template>
</template>
