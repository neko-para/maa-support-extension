<script setup lang="ts">
import type { VscodeCheckbox } from '@vscode-elements/elements'

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
      <span></span>
      <vscode-checkbox
        label="helper axes overflow"
        :checked="settingsSt.helperAxesOverflow.value"
        @change="
          (e: Event) => (settingsSt.helperAxesOverflow.value = (e.target as VscodeCheckbox).checked)
        "
      ></vscode-checkbox>
      <span class="mse-fixed-label"> helper axes radius </span>
      <vscode-textfield v-model="settingsSt.helperAxesRadius.value"></vscode-textfield>
      <span class="mse-fixed-label"> helper axes threshold </span>
      <vscode-textfield v-model="settingsSt.helperAxesThreshold.value"></vscode-textfield>
      <!-- <vscode-textfield v-model="settingsSt.pixelBoundStroke.value"></vscode-textfield> -->
    </div>
    <span class="mse-fixed-label"> ocr stroke </span>
    <vscode-textfield v-model="settingsSt.ocrStroke.value"></vscode-textfield>
    <span class="mse-fixed-label"> ocr font </span>
    <vscode-textfield v-model="settingsSt.ocrFont.value"></vscode-textfield>
    <v-pick></v-pick>
    <v-ocr></v-ocr>
  </div>
</template>
