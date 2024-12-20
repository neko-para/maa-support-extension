<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import hljsJson from 'highlight.js/lib/languages/json'
import {
  NButton,
  NCard,
  NCode,
  NConfigProvider,
  NModal,
  NTabPane,
  NTabs,
  darkTheme,
  lightTheme
} from 'naive-ui'
import { onMounted, ref } from 'vue'

import MCrop from '@/crop/MCrop.vue'

import { activePage, themeType } from './data'
import { send } from './ipc'

hljs.registerLanguage('json', hljsJson)

const theme = ref(lightTheme)

function updateTheme() {
  const type = document.body.getAttribute('class') ?? 'vscode-light'
  if (/vscode-light/.test(type)) {
    theme.value = lightTheme
    themeType.value = 'light'
  } else if (/vscode-dark/.test(type)) {
    theme.value = darkTheme
    themeType.value = 'dark'
  } else {
    theme.value = lightTheme
    themeType.value = 'light'
  }
}

onMounted(() => {
  const obsv = new MutationObserver(() => {
    updateTheme()
  })
  obsv.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  })
  updateTheme()
})
</script>

<template>
  <n-config-provider :hljs="hljs" :theme="theme">
    <div class="flex flex-col gap-2 w-screen h-screen p-2">
      <n-tabs v-model:value="activePage">
        <n-tab-pane name="crop"></n-tab-pane>
      </n-tabs>
      <template v-if="activePage === 'crop'">
        <m-crop></m-crop>
      </template>
    </div>
  </n-config-provider>
</template>

<style scoped>
.maa-form {
  display: grid;
  grid-template-columns: max-content auto;
  align-items: center;
  gap: 0.5rem;
}
</style>
