<script lang="ts" setup>
import { VscButton, VscScrollable } from '@/components/VscEl'
import * as ocrSt from '@/crop/states/ocr'
import * as recoSt from '@/crop/states/reco'
</script>

<template>
  <div class="flex gap-1 items-center">
    <vsc-button
      @click="ocrSt.perform()"
      :loading="ocrSt.loading.value"
      :disabled="ocrSt.loading.value"
    >
      OCR
    </vsc-button>
    <div v-if="ocrSt.resultObject.value" class="flex flex-col gap-2">
      <div class="flex gap-2">
        <vsc-button
          @click="ocrSt.draw.value = !ocrSt.draw.value"
          :icon="ocrSt.draw.value ? 'check' : undefined"
        >
          draw
        </vsc-button>
      </div>
      <vsc-scrollable v-if="ocrSt.resultObject.value" style="height: 20rem">
        <pre class="mse-bg-vscode-sideBar-background">{{
          JSON.stringify(ocrSt.resultObject.value, null, 4)
        }}</pre>
      </vsc-scrollable>
    </div>
  </div>
  <div class="flex gap-1 items-center">
    <vsc-button
      @click="recoSt.perform()"
      :loading="recoSt.loading.value"
      :disabled="recoSt.loading.value"
    >
      Reco
    </vsc-button>
    <div v-if="recoSt.resultObject.value" class="flex flex-col gap-2">
      <div class="flex gap-2">
        <vsc-button
          @click="recoSt.draw.value = !recoSt.draw.value"
          :icon="recoSt.draw.value ? 'check' : undefined"
        >
          draw
        </vsc-button>
      </div>
      <vsc-scrollable v-if="recoSt.resultObject.value" style="height: 20rem">
        <pre class="mse-bg-vscode-sideBar-background">{{
          JSON.stringify(recoSt.resultObject.value, null, 4)
        }}</pre>
      </vsc-scrollable>
    </div>
  </div>
</template>
