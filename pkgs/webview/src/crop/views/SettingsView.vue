<script setup lang="ts">
import { NFlex, NInput, NInputNumber, NScrollbar, NSwitch, NText } from 'naive-ui'

import type { CropHostState } from '@mse/types'

import { t } from '../../utils/locale'
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
    <n-text> {{ t('maa.crop.settings.saving-file-with-roi') }} </n-text>
    <n-flex>
      <n-switch
        :value="hostState.saveAddRoiInfo"
        @update:value="v => update('saveAddRoiInfo', v)"
      ></n-switch>
      <n-text>
        {{
          hostState.saveAddRoiInfo
            ? t('maa.crop.settings.with-roi')
            : t('maa.crop.settings.without-roi')
        }}
      </n-text>
    </n-flex>
    <n-text> {{ t('maa.crop.settings.background-color') }} </n-text>
    <n-input
      :value="hostState.backgroundFill"
      placeholder="white"
      @update:value="v => update('backgroundFill', v)"
    ></n-input>
    <n-text> {{ t('maa.crop.settings.select-color') }} </n-text>
    <n-input
      :value="hostState.selectFill"
      placeholder="wheat"
      @update:value="v => update('selectFill', v)"
    ></n-input>
    <n-text> {{ t('maa.crop.settings.select-opacity') }} </n-text>
    <n-input-number
      :value="hostState.selectOpacity"
      placeholder="0.3"
      :min="0"
      :max="1"
      :step="0.1"
      @update:value="v => update('selectOpacity', v ?? undefined)"
    ></n-input-number>
    <n-text> {{ t('maa.crop.settings.scale-direction') }} </n-text>
    <n-flex>
      <n-switch
        :value="hostState.revertScale"
        @update:value="v => update('revertScale', v)"
      ></n-switch>
      <n-text>
        {{
          hostState.revertScale
            ? t('maa.crop.settings.revert-scale')
            : t('maa.crop.settings.default-scale')
        }}
      </n-text>
    </n-flex>
    <n-text> {{ t('maa.crop.settings.pointer-axes-stroke') }} </n-text>
    <n-input
      :value="hostState.pointerAxesStroke"
      placeholder="rgba(255, 127, 127, 1)"
      @update:value="v => update('pointerAxesStroke', v)"
    ></n-input>
    <n-text> {{ t('maa.crop.settings.helper-axes-stroke') }} </n-text>
    <n-input
      :value="hostState.helperAxesStroke"
      placeholder="white"
      @update:value="v => update('helperAxesStroke', v)"
    ></n-input>
    <n-text> {{ t('maa.crop.settings.helper-axes-opacity') }} </n-text>
    <n-input-number
      :value="hostState.helperAxesOpacity"
      placeholder="0.4"
      :min="0"
      :max="1"
      :step="0.1"
      @update:value="v => update('helperAxesOpacity', v ?? undefined)"
    ></n-input-number>
    <n-text> {{ t('maa.crop.settings.helper-axes-mode') }} </n-text>
    <n-flex>
      <n-switch
        :value="hostState.helperAxesOverflow"
        @update:value="v => update('helperAxesOverflow', v)"
      ></n-switch>
      <n-text>
        {{
          hostState.helperAxesOverflow
            ? t('maa.crop.settings.helper-axes-mode-rect')
            : t('maa.crop.settings.helper-axes-mode-round')
        }}
      </n-text>
    </n-flex>
    <n-text> {{ t('maa.crop.settings.helper-axes-radius') }} </n-text>
    <n-input-number
      :value="hostState.helperAxesRadius"
      placeholder="20"
      :min="0"
      :step="5"
      @update:value="v => update('helperAxesRadius', v ?? undefined)"
    ></n-input-number>
    <n-text> {{ t('maa.crop.settings.helper-axes-threshold') }} </n-text>
    <n-input-number
      :value="hostState.helperAxesThreshold"
      placeholder="10"
      :min="0"
      :show-button="false"
      @update:value="v => update('helperAxesThreshold', v ?? undefined)"
    ></n-input-number>
    <n-text> {{ t('maa.crop.settings.ocr-result-color') }} </n-text>
    <n-input
      :value="hostState.ocrStroke"
      placeholder="green"
      @update:value="v => update('ocrStroke', v)"
    ></n-input>
    <n-text> {{ t('maa.crop.settings.ocr-result-font') }} </n-text>
    <n-input
      :value="hostState.ocrFont"
      placeholder="24pt consolas"
      @update:value="v => update('ocrFont', v)"
    ></n-input
    ><n-text> {{ t('maa.crop.settings.reco-result-color') }} </n-text>
    <n-input
      :value="hostState.recoStroke"
      placeholder="green"
      @update:value="v => update('recoStroke', v)"
    ></n-input>
    <n-text> {{ t('maa.crop.settings.reco-result-font') }} </n-text>
    <n-input
      :value="hostState.recoFont"
      placeholder="24pt consolas"
      @update:value="v => update('recoFont', v)"
    ></n-input>
  </n-flex>
</template>
