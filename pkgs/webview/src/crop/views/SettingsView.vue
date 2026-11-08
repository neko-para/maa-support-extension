<script setup lang="ts">
import { NCard, NCollapse, NCollapseItem, NFlex } from 'naive-ui'

import { t } from '../../utils/locale'
import SettingsInput from '../components/SettingsInput.vue'
import SettingsInputNumber from '../components/SettingsInputNumber.vue'
import SettingsSwitch from '../components/SettingsSwitch.vue'
import * as settingsSt from '../states/settings'

// 保存相关设置已就近移到导出面板；本页只留外观与低频高级项
</script>

<template>
  <n-flex vertical style="padding: 8px">
    <n-card :title="t('maa.crop.settings.group.canvas')" size="small">
      <n-flex vertical>
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
        <settings-input-number
          v-if="settingsSt.selectOutlineOnly.eff"
          :inst="settingsSt.selectOutlineThickness"
          :title="t('maa.crop.settings.select-outline-thickness')"
          :min="1"
          :max="20"
          :step="1"
        ></settings-input-number>
      </n-flex>
    </n-card>

    <n-card :title="t('maa.crop.settings.group.interaction')" size="small">
      <n-flex vertical>
        <settings-switch
          :inst="settingsSt.revertScale"
          :title="t('maa.crop.settings.scale-direction')"
          :on="t('maa.crop.settings.revert-scale')"
          :off="t('maa.crop.settings.default-scale')"
        ></settings-switch>
      </n-flex>
    </n-card>

    <!-- 低频项默认折叠：指针轴、识别结果显示样式 -->
    <n-collapse arrow-placement="right" :default-expanded-names="[]">
      <n-collapse-item :title="t('maa.crop.settings.group.advanced')" name="advanced">
        <n-flex vertical>
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
      </n-collapse-item>
    </n-collapse>
  </n-flex>
</template>
