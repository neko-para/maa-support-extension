<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { NCard, NConfigProvider, NFlex, NScrollbar } from 'naive-ui'
import { ref } from 'vue'

import { t } from '../utils/locale'
import { useTheme } from '../utils/theme'
import * as canvasSt from './states/canvas'
import * as controlSt from './states/control'
import { showTab } from './states/visible'
import ControlView from './views/ControlView.vue'
import SettingsView from './views/SettingsView.vue'
import ToolView from './views/ToolView.vue'

const { loaded, theme, themeOverride } = useTheme('panel')

hljs.registerLanguage('json', json)

const canvasSizeEl = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

canvasSt.setup(canvasSizeEl, canvasEl)
</script>

<template>
  <template v-if="loaded">
    <n-config-provider :theme="theme" :theme-overrides="themeOverride" :hljs="hljs">
      <n-card
        :title="t('maa.crop.crop-tool')"
        style="height: 100vh"
        content-style="display: flex; flex-direction: column; gap: 10px; min-height: 0"
        size="small"
      >
        <template #header-extra>
          <control-view></control-view>
        </template>

        <n-flex style="flex: 1; min-height: 0">
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
          <n-scrollbar v-if="showTab" style="width: 40vw">
            <settings-view v-if="showTab === 'settings'"></settings-view>
            <tool-view v-else-if="showTab === 'tool'"></tool-view>
          </n-scrollbar>
        </n-flex>
      </n-card>
    </n-config-provider>
  </template>
</template>
