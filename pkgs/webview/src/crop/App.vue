<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { NCard, NConfigProvider } from 'naive-ui'
import { ref } from 'vue'

import { useTheme } from '../utils/theme'
import * as canvasSt from './states/canvas'
import * as controlSt from './states/control'
import ControlView from './views/ControlView.vue'

const { theme, themeOverride } = useTheme('panel')

hljs.registerLanguage('json', json)

const canvasSizeEl = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

canvasSt.setup(canvasSizeEl, canvasEl)
</script>

<template>
  <n-config-provider :theme="theme" :theme-overrides="themeOverride" :hljs="hljs">
    <n-card
      title="编辑"
      style="height: 100vh"
      content-style="display: flex; flex-direction: column; gap: 10px"
    >
      <template #header-extra>
        <control-view></control-view>
      </template>

      <div ref="canvasSizeEl" style="position: relative; flex: 1">
        <canvas
          ref="canvasEl"
          :style="{
            position: 'absolute',
            left: 0,
            top: 0,
            cursor: controlSt.cursor.value
          }"
          @wheel.prevent="controlSt.onWheel"
          @pointerdown.prevent="controlSt.onPointerDown"
          @pointermove.prevent="controlSt.onPointerMove"
          @pointerup.prevent="controlSt.onPointerUp"
          @contextmenu.prevent="controlSt.onContextMenu"
        ></canvas>
      </div>
    </n-card>
  </n-config-provider>
</template>
