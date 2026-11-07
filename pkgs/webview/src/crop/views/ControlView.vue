<script setup lang="ts">
import { NAlert, NButton, NFlex } from 'naive-ui'

import Tooltip from '../../components/AppTooltip.vue'
import { t } from '../../utils/locale'
import * as controlSt from '../states/control'
import * as imageSt from '../states/image'
import { showTab, toggleShow } from '../states/visible'
</script>

<template>
  <n-flex vertical style="max-width: calc(100vw - 150px)">
    <n-flex align="center">
      <Tooltip trigger="hover">
        <template #trigger>
          <n-button
            :loading="imageSt.screencapLoading.value"
            @click="imageSt.screencap()"
            size="small"
          >
            {{ t('maa.crop.screencap') }}
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.screencap') }}
      </Tooltip>
      <Tooltip trigger="hover">
        <template #trigger>
          <n-button :loading="imageSt.uploadLoading.value" @click="imageSt.upload()" size="small">
            {{ t('maa.crop.upload') }}
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.upload') }}
      </Tooltip>
      <Tooltip trigger="hover">
        <template #trigger>
          <n-button
            :loading="imageSt.downloadLoading.value"
            :disabled="!imageSt.data.value"
            @click="imageSt.download()"
            size="small"
          >
            {{ t('maa.crop.download') }}
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.download') }}
      </Tooltip>
      <Tooltip trigger="hover">
        <template #trigger>
          <n-button @click="controlSt.viewport.value.reset()" size="small">
            {{ t('maa.crop.reset-viewport') }}
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.reset-viewport') }}
      </Tooltip>
      <Tooltip trigger="hover">
        <template #trigger>
          <n-button @click="controlSt.cropCeil()" size="small"> {{ t('maa.crop.ceil') }} </n-button>
        </template>
        {{ t('maa.crop.tooltip.ceil') }}
      </Tooltip>
      <Tooltip trigger="hover">
        <template #trigger>
          <n-button @click="controlSt.cropBound()" :disabled="!imageSt.data.value" size="small">
            {{ t('maa.crop.bound') }}
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.bound') }}
      </Tooltip>
      <Tooltip trigger="hover">
        <template #trigger>
          <n-button
            :loading="imageSt.resizing.value"
            :disabled="!imageSt.data.value"
            @click="imageSt.resize()"
            size="small"
          >
            {{ t('maa.crop.resize') }}
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.resize') }}
      </Tooltip>
      <Tooltip trigger="hover">
        <template #trigger>
          <n-button
            :type="showTab === 'settings' ? 'primary' : 'default'"
            @click="toggleShow('settings')"
            size="small"
          >
            {{ t('maa.crop.settings') }}
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.settings') }}
      </Tooltip>
      <Tooltip trigger="hover">
        <template #trigger>
          <n-button
            :type="showTab === 'tool' ? 'primary' : 'default'"
            @click="toggleShow('tool')"
            size="small"
          >
            {{ t('maa.crop.tools') }}
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.tools') }}
      </Tooltip>
    </n-flex>
    <n-flex align="center">
      <n-flex align="center">
        <Tooltip trigger="hover">
          <template #trigger>
            <span>ROI</span>
          </template>
          {{ t('maa.crop.tooltip.roi') }}
        </Tooltip>
        {{ controlSt.roiDisp() }}
        <Tooltip trigger="hover">
          <template #trigger>
            <n-button @click="controlSt.copyRoi()" size="small">
              {{ t('maa.crop.copy') }}
            </n-button>
          </template>
          {{ t('maa.crop.tooltip.copy-roi') }}
        </Tooltip>
        <Tooltip trigger="hover">
          <template #trigger>
            <n-button @click="controlSt.pasteRoi()" size="small">
              {{ t('maa.crop.paste') }}
            </n-button>
          </template>
          {{ t('maa.crop.tooltip.paste-roi') }}
        </Tooltip>
        <Tooltip trigger="hover">
          <template #trigger>
            <n-button @click="controlSt.copyRoiField()" size="small">
              {{ t('maa.crop.copy-field') }}
            </n-button>
          </template>
          {{ t('maa.crop.tooltip.copy-roi-field') }}
        </Tooltip>
      </n-flex>
      <n-flex align="center">
        <Tooltip trigger="hover">
          <template #trigger>
            <span>ROI EX</span>
          </template>
          {{ t('maa.crop.tooltip.roi-ex') }}
        </Tooltip>
        {{ controlSt.roiExpandDisp() }}
        <Tooltip trigger="hover">
          <template #trigger>
            <n-button @click="controlSt.copyRoiExpand()" size="small">
              {{ t('maa.crop.copy') }}
            </n-button>
          </template>
          {{ t('maa.crop.tooltip.copy-roi-ex') }}
        </Tooltip>
      </n-flex>
    </n-flex>

    <n-alert
      v-if="imageSt.screencapError.value"
      type="error"
      closable
      @close="imageSt.screencapError.value = null"
    >
      {{ imageSt.screencapError.value }}
    </n-alert>
    <n-alert
      v-if="imageSt.uploadError.value"
      type="error"
      closable
      @close="imageSt.uploadError.value = null"
    >
      {{ imageSt.uploadError.value }}
    </n-alert>
    <n-alert
      v-if="imageSt.saveError.value"
      type="error"
      closable
      @close="imageSt.saveError.value = null"
    >
      {{ imageSt.saveError.value }}
    </n-alert>
    <n-alert v-if="imageSt.saveInfo.value" type="success" closable @close="imageSt.clearSaveInfo()">
      <n-flex align="center">
        <span>{{ imageSt.saveInfo.value }}</span>
        <n-button size="tiny" @click="imageSt.revealSaved()">
          {{ t('maa.crop.save.open-folder') }}
        </n-button>
        <n-button
          v-if="imageSt.savedRelativePath.value"
          size="tiny"
          @click="imageSt.copyTemplateSnippet()"
        >
          {{ t('maa.crop.save.copy-template') }}
        </n-button>
      </n-flex>
    </n-alert>
    <n-alert v-if="imageSt.emptyRoiWarning.value" type="warning">
      <n-flex align="center">
        <span>{{ t('maa.crop.save.empty-roi') }}</span>
        <n-button size="tiny" @click="imageSt.download(true)">
          {{ t('maa.crop.save.save-whole') }}
        </n-button>
        <n-button size="tiny" @click="imageSt.cancelEmptyRoiWarning()">
          {{ t('maa.crop.save.cancel') }}
        </n-button>
      </n-flex>
    </n-alert>
  </n-flex>
</template>
