<script lang="ts" setup>
import { useTemplateRef } from 'vue'

import * as canvasSt from '@/crop/states/canvas'
import * as controlSt from '@/crop/states/control'
import VControl from '@/crop/views/VControl.vue'

const canvasSizeEl = useTemplateRef('canvasSizeEl')
const canvasEl = useTemplateRef('canvasEl')

canvasSt.setup(canvasSizeEl, canvasEl)
</script>

<template>
  <div id="root">
    <v-control></v-control>
    <div ref="canvasSizeEl" class="relative flex-1">
      <canvas
        ref="canvasEl"
        class="absolute left-0 top-0"
        :style="{
          cursor: controlSt.cursor.value
        }"
        @wheel="controlSt.onWheel"
        @pointerdown="controlSt.onPointerDown"
        @pointermove="controlSt.onPointerMove"
        @pointerup="controlSt.onPointerUp"
        @contextmenu="controlSt.onContextMenu"
      ></canvas>
    </div>
  </div>
</template>
