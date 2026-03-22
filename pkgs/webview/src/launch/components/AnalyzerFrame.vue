<script setup lang="ts">
import { NCard, NText } from 'naive-ui'
import { computed, onUnmounted, ref, watch } from 'vue'

import { t } from '../../utils/locale'
import { hostState } from '../state'
import { analyzerBridge } from '../states/analyzer'

const iframeEl = ref<HTMLIFrameElement | null>(null)
const analyzerUrl = computed(() => hostState.value.analyzerUrl?.trim() ?? '')

watch(analyzerUrl, () => {
  analyzerBridge.setIframe(null)
})
watch(iframeEl, iframe => {
  if (iframe) {
    analyzerBridge.setIframe(iframe)
  }
})

function onIframeLoad() {
  analyzerBridge.setIframe(iframeEl.value)
}

onUnmounted(() => {
  analyzerBridge.setIframe(null)
})
</script>

<template>
  <n-card
    :title="t('maa.launch.analyzer')"
    content-style="height: 100%; padding: 0;"
    style="height: 100%"
  >
    <template v-if="analyzerUrl">
      <iframe
        ref="iframeEl"
        :src="analyzerUrl"
        class="analyzer-iframe"
        @load="onIframeLoad"
      ></iframe>
    </template>
    <n-text v-else depth="3" style="display: block; padding: 16px">
      {{ t('maa.launch.analyzer-empty') }}
    </n-text>
  </n-card>
</template>

<style scoped>
.analyzer-iframe {
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
