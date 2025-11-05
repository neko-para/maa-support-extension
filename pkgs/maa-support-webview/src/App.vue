<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { NCard, NConfigProvider, NSplit } from 'naive-ui'
import { ref } from 'vue'

import { useTheme } from './utils/theme'

const { loaded, theme, themeOverride } = useTheme('panel')

hljs.registerLanguage('json', json)
</script>

<template>123123</template>
