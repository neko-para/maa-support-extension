<script setup lang="ts">
import type { VscodeCheckbox } from '@vscode-elements/elements'

import * as settingsSt from '@/crop/states/settings'
import VPick from '@/crop/views/VPick.vue'

import VTools from './VTools.vue'
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
      <span> helper axes overflow </span>
      <vscode-checkbox
        :checked="settingsSt.helperAxesOverflow.value"
        @change="
          (e: Event) => (settingsSt.helperAxesOverflow.value = (e.target as VscodeCheckbox).checked)
        "
      ></vscode-checkbox>
      <span class="mse-fixed-label"> helper axes stroke </span>
      <vscode-textfield v-model="settingsSt.helperAxesStroke.value"></vscode-textfield>
      <span class="mse-fixed-label"> helper axes alpha </span>
      <vscode-textfield v-model="settingsSt.helperAxesOpacity.value"></vscode-textfield>
      <span class="mse-fixed-label"> helper axes radius </span>
      <vscode-textfield v-model="settingsSt.helperAxesRadius.value"></vscode-textfield>
      <span class="mse-fixed-label"> helper axes threshold </span>
      <vscode-textfield v-model="settingsSt.helperAxesThreshold.value"></vscode-textfield>
    </div>
    <span class="mse-fixed-label"> ocr stroke </span>
    <vscode-textfield v-model="settingsSt.ocrStroke.value"></vscode-textfield>
    <span class="mse-fixed-label"> ocr font </span>
    <vscode-textfield v-model="settingsSt.ocrFont.value"></vscode-textfield>
    <span class="mse-fixed-label"> reco stroke </span>
    <vscode-textfield v-model="settingsSt.recoStroke.value"></vscode-textfield>
    <span class="mse-fixed-label"> reco font </span>
    <vscode-textfield v-model="settingsSt.recoFont.value"></vscode-textfield>
    <v-pick></v-pick>
    <v-tools></v-tools>
  </div>
</template>
