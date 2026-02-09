<script setup lang="ts">
import { NFlex } from 'naive-ui'

import { t } from '../../utils/locale'
import SettingsInput from '../components/SettingsInput.vue'
import SettingsInputNumber from '../components/SettingsInputNumber.vue'
import SettingsSwitch from '../components/SettingsSwitch.vue'
import * as settingsSt from '../states/settings'
</script>

<template>
  <n-flex vertical>
    <settings-switch
      :inst="settingsSt.saveAddRoiInfo"
      :title="t('maa.crop.settings.saving-file-with-roi')"
      :on="t('maa.crop.settings.with-roi')"
      :off="t('maa.crop.settings.without-roi')"
    ></settings-switch>

    <settings-input
      :inst="settingsSt.backgroundFill"
      :title="t('maa.crop.settings.background-color')"
      isColor
    ></settings-input>
    <settings-input
      :inst="settingsSt.selectFill"
      :title="t('maa.crop.settings.select-color')"
      isColor
    ></settings-input>
    <settings-input-number
      :inst="settingsSt.selectOpacity"
      :title="t('maa.crop.settings.select-opacity')"
      :min="0"
      :max="1"
      :step="0.1"
    ></settings-input-number>

    <settings-switch
      :inst="settingsSt.selectOutlineOnly"
      :title="t('maa.crop.settings.select-outline-only')"
      on=""
      off=""
    ></settings-switch>
    <template v-if="settingsSt.selectOutlineOnly.eff">
      <settings-input-number
        :inst="settingsSt.selectOutlineThickness"
        :title="t('maa.crop.settings.select-outline-thickness')"
        :min="1"
        :max="20"
        :step="1"
      ></settings-input-number>
    </template>

    <settings-switch
      :inst="settingsSt.revertScale"
      :title="t('maa.crop.settings.scale-direction')"
      :on="t('maa.crop.settings.revert-scale')"
      :off="t('maa.crop.settings.default-scale')"
    ></settings-switch>

    <settings-input
      :inst="settingsSt.pointerAxesStroke"
      :title="t('maa.crop.settings.pointer-axes-stroke')"
      isColor
    ></settings-input>
    <settings-input
      :inst="settingsSt.helperAxesStroke"
      :title="t('maa.crop.settings.helper-axes-stroke')"
      isColor
    ></settings-input>
    <settings-input-number
      :inst="settingsSt.helperAxesOpacity"
      :title="t('maa.crop.settings.helper-axes-opacity')"
      :min="0"
      :max="1"
      :step="0.1"
    ></settings-input-number>
    <settings-switch
      :inst="settingsSt.helperAxesOverflow"
      :title="t('maa.crop.settings.helper-axes-mode')"
      :on="t('maa.crop.settings.helper-axes-mode-rect')"
      :off="t('maa.crop.settings.helper-axes-mode-round')"
    ></settings-switch>
    <settings-input-number
      :inst="settingsSt.helperAxesRadius"
      :title="t('maa.crop.settings.helper-axes-radius')"
      :min="0"
      :step="5"
    ></settings-input-number>
    <settings-input-number
      :inst="settingsSt.helperAxesThreshold"
      :title="t('maa.crop.settings.helper-axes-threshold')"
      :min="0"
      :show-button="false"
    ></settings-input-number>

    <settings-input-number
      :inst="settingsSt.pickColorThreshold"
      :title="t('maa.crop.settings.pick-color-threshold')"
      :min="0"
      :show-button="false"
    ></settings-input-number>
    <settings-input-number
      :inst="settingsSt.templateMatchThreshold"
      :title="t('maa.crop.settings.template-match-threshold')"
      :min="0"
      :max="1"
      :step="0.01"
    ></settings-input-number>

    <settings-input
      :inst="settingsSt.ocrStroke"
      :title="t('maa.crop.settings.ocr-result-color')"
      isColor
    ></settings-input>
    <settings-input
      :inst="settingsSt.ocrFont"
      :title="t('maa.crop.settings.ocr-result-font')"
    ></settings-input>

    <settings-input
      :inst="settingsSt.recoStroke"
      :title="t('maa.crop.settings.reco-result-color')"
      isColor
    ></settings-input>
    <settings-input
      :inst="settingsSt.recoFont"
      :title="t('maa.crop.settings.reco-result-font')"
    ></settings-input>
  </n-flex>
</template>
