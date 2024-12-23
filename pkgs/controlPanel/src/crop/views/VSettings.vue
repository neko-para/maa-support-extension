<script setup lang="ts">
import * as settingsSt from '@/crop/states/settings'
import VPick from '@/crop/views/VPick.vue'

import VOcr from './VOcr.vue'
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="mse-grid-form">
      <span class="mse-fixed-label"> background fill </span>
      <vscode-textfield v-model="settingsSt.backgroundFill.value"></vscode-textfield>
      <span class="mse-fixed-label"> select fill </span>
      <vscode-textfield v-model="settingsSt.selectFill.value"></vscode-textfield>
      <span class="mse-fixed-label"> select alpha </span>
      <vscode-textfield v-model="settingsSt.selectOpacity.value"></vscode-textfield>
      <span class="mse-fixed-label"> pointer axes fill </span>
      <vscode-textfield v-model="settingsSt.pointerAxesStroke.value"></vscode-textfield>
      <span class="mse-fixed-label"> ocr stroke </span>
      <vscode-textfield v-model="settingsSt.ocrStroke.value"></vscode-textfield>
      <!-- <vscode-textfield v-model="settingsSt.pixelBoundStroke.value"></vscode-textfield> -->
    </div>
    <v-pick></v-pick>
    <v-ocr></v-ocr>
  </div>
</template>
