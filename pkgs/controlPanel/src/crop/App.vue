<script lang="ts" setup>
import { useTemplateRef } from 'vue'

import * as canvasSt from '@/crop/states/canvas'
import VControl from '@/crop/views/VControl.vue'

const canvasSizeEl = useTemplateRef('canvasSizeEl')
const canvasEl = useTemplateRef('canvasEl')

canvasSt.setup(canvasSizeEl, canvasEl)
</script>

<template>
  <div id="root">
    <v-control></v-control>
    <div ref="canvasSizeEl" class="relative flex-1">
      <canvas ref="canvasEl" class="absolute left-0 top-0"></canvas>
    </div>
  </div>
</template>
