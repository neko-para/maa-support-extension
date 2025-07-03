<script setup lang="ts">
import { NFlex, NInput, NInputNumber, NScrollbar, NSwitch, NText } from 'naive-ui'

import type { CropHostState } from '@mse/types'

import { ipc } from '../ipc'
import { hostState } from '../state'

function update<K extends keyof CropHostState>(key: K, value: CropHostState[K]) {
  ipc.send({
    command: 'updateSettings',
    key,
    value
  })
}
</script>

<template>
  <n-flex vertical>
    <n-text> 保存时文件名中附带ROI </n-text>
    <n-flex>
      <n-switch
        :value="hostState.saveAddRoiInfo"
        @update:value="v => update('saveAddRoiInfo', v)"
      ></n-switch>
      <n-text> {{ hostState.saveAddRoiInfo ? '附带ROI' : '不附带ROI' }} </n-text>
    </n-flex>
    <n-text> 背景色 </n-text>
    <n-input
      :value="hostState.backgroundFill"
      placeholder="white"
      @update:value="v => update('backgroundFill', v)"
    ></n-input>
    <n-text> 选中色 </n-text>
    <n-input
      :value="hostState.selectFill"
      placeholder="wheat"
      @update:value="v => update('selectFill', v)"
    ></n-input>
    <n-text> 选中透明度 </n-text>
    <n-input-number
      :value="hostState.selectOpacity"
      placeholder="0.3"
      :min="0"
      :max="1"
      :step="0.1"
      @update:value="v => update('selectOpacity', v ?? undefined)"
    ></n-input-number>
    <n-text> 鼠标指示线色 </n-text>
    <n-input
      :value="hostState.pointerAxesStroke"
      placeholder="rgba(255, 127, 127, 1)"
      @update:value="v => update('pointerAxesStroke', v)"
    ></n-input>
    <n-text> 辅助指示线色 </n-text>
    <n-input
      :value="hostState.helperAxesStroke"
      placeholder="white"
      @update:value="v => update('helperAxesStroke', v)"
    ></n-input>
    <n-text> 辅助指示线透明度 </n-text>
    <n-input-number
      :value="hostState.helperAxesOpacity"
      placeholder="0.4"
      :min="0"
      :max="1"
      :step="0.1"
      @update:value="v => update('helperAxesOpacity', v ?? undefined)"
    ></n-input-number>
    <n-text> 辅助指示线模式 </n-text>
    <n-flex>
      <n-switch
        :value="hostState.helperAxesOverflow"
        @update:value="v => update('helperAxesOverflow', v)"
      ></n-switch>
      <n-text> {{ hostState.helperAxesOverflow ? '矩形' : '圆形' }} </n-text>
    </n-flex>
    <n-text> 辅助指示线半径 </n-text>
    <n-input-number
      :value="hostState.helperAxesRadius"
      placeholder="20"
      :min="0"
      :step="5"
      @update:value="v => update('helperAxesRadius', v ?? undefined)"
    ></n-input-number>
    <n-text> 辅助指示线展示阈值 </n-text>
    <n-input-number
      :value="hostState.helperAxesThreshold"
      placeholder="10"
      :min="0"
      :show-button="false"
      @update:value="v => update('helperAxesThreshold', v ?? undefined)"
    ></n-input-number>
    <n-text> OCR结果颜色 </n-text>
    <n-input
      :value="hostState.ocrStroke"
      placeholder="green"
      @update:value="v => update('ocrStroke', v)"
    ></n-input>
    <n-text> OCR结果字体 </n-text>
    <n-input
      :value="hostState.ocrFont"
      placeholder="24pt consolas"
      @update:value="v => update('ocrFont', v)"
    ></n-input
    ><n-text> 识别结果颜色 </n-text>
    <n-input
      :value="hostState.recoStroke"
      placeholder="green"
      @update:value="v => update('recoStroke', v)"
    ></n-input>
    <n-text> 识别结果字体 </n-text>
    <n-input
      :value="hostState.recoFont"
      placeholder="24pt consolas"
      @update:value="v => update('recoFont', v)"
    ></n-input>
  </n-flex>
</template>
