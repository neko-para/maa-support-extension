<script setup lang="ts">
import { NButton, NCard, NFlex, NInput, NText } from 'naive-ui'

import Tooltip from '../../components/AppTooltip.vue'
import { t } from '../../utils/locale'
import SettingsInput from '../components/SettingsInput.vue'
import SettingsInputNumber from '../components/SettingsInputNumber.vue'
import SettingsSwitch from '../components/SettingsSwitch.vue'
import { ipc } from '../ipc'
import * as settingsSt from '../states/settings'

async function pickSaveDir() {
  const dir = (await ipc.call({ command: 'requestPickFolder' })) as string | null
  if (dir) {
    settingsSt.saveDir.val = dir
  }
}
</script>

<template>
  <n-flex vertical>
    <n-card :title="t('maa.crop.settings.group.save')" size="small">
      <n-flex vertical>
        <settings-switch
          :inst="settingsSt.saveAddRoiInfo"
          :title="t('maa.crop.settings.saving-file-with-roi')"
          :on="t('maa.crop.settings.with-roi')"
          :off="t('maa.crop.settings.without-roi')"
        ></settings-switch>
        <n-flex align="center">
          <Tooltip trigger="hover">
            <template #trigger>
              <n-text>{{ t('maa.crop.settings.save-dir') }}</n-text>
            </template>
            {{ t('maa.crop.tooltip.save-dir') }}
          </Tooltip>
          <n-input
            readonly
            size="small"
            style="flex: 1"
            :value="settingsSt.saveDir.val ?? ''"
            :placeholder="t('maa.crop.settings.save-dir-default')"
          ></n-input>
          <n-button size="small" @click="pickSaveDir()">
            {{ t('maa.crop.settings.save-dir-pick') }}
          </n-button>
          <n-button
            v-if="settingsSt.saveDir.val"
            size="small"
            @click="settingsSt.saveDir.val = undefined"
          >
            {{ t('maa.crop.settings.save-dir-clear') }}
          </n-button>
        </n-flex>
      </n-flex>
    </n-card>

    <n-card :title="t('maa.crop.settings.group.crop')" size="small">
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

    <n-card :title="t('maa.crop.settings.group.viewport')" size="small">
      <n-flex vertical>
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
      </n-flex>
    </n-card>

    <n-card :title="t('maa.crop.settings.group.pick')" size="small">
      <n-flex vertical>
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
      </n-flex>
    </n-card>

    <n-card :title="t('maa.crop.settings.group.display')" size="small">
      <n-flex vertical>
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
    </n-card>
  </n-flex>
</template>
