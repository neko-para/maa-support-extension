<script lang="ts" setup>
import { onMounted, useTemplateRef } from 'vue'

import * as canvasSt from '@/crop/states/canvas'
import * as controlSt from '@/crop/states/control'
import * as settingsSt from '@/crop/states/settings'
import VControl from '@/crop/views/VControl.vue'

import VSettings from './views/VSettings.vue'

const canvasSizeEl = useTemplateRef('canvasSizeEl')
const canvasEl = useTemplateRef('canvasEl')

canvasSt.setup(canvasSizeEl, canvasEl)

onMounted(() => {
  document.addEventListener('keydown', controlSt.onKeyDown)
  document.addEventListener('keyup', controlSt.onKeyUp)
})
</script>

<template>
  <div id="root">
    <v-control></v-control>
    <div class="flex-1 flex gap-2">
      <div ref="canvasSizeEl" class="relative flex-1">
        <canvas
          ref="canvasEl"
          class="absolute left-0 top-0"
          :style="{
            cursor: controlSt.cursor.value
          }"
          @wheel.prevent="controlSt.onWheel"
          @pointerdown.prevent="controlSt.onPointerDown"
          @pointermove.prevent="controlSt.onPointerMove"
          @pointerup.prevent="controlSt.onPointerUp"
          @contextmenu.prevent="controlSt.onContextMenu"
        ></canvas>
      </div>
      <v-settings v-if="settingsSt.show.value"></v-settings>
    </div>
  </div>
</template>
