<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { NConfigProvider } from 'naive-ui'

import { useTheme } from '../utils/theme'

const { theme, themeOverride } = useTheme('panel')

hljs.registerLanguage('json', json)
</script>

<template>
  <n-config-provider :theme="theme" :theme-overrides="themeOverride" :hljs="hljs">
    <div>123</div>
  </n-config-provider>
</template>
