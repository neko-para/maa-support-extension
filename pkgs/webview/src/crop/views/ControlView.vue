<script setup lang="ts">
import { NButton, NFlex, NTooltip } from 'naive-ui'

import { t } from '../../utils/locale'
import * as controlSt from '../states/control'
import * as imageSt from '../states/image'
import { toggleShow } from '../states/visible'
</script>

<template>
  <n-flex vertical style="max-width: calc(100vw - 150px)">
    <n-flex align="center">
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button :loading="imageSt.loading.value" @click="imageSt.screencap()" size="small">
            {{ t('maa.crop.screencap') }}
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.screencap') }}
      </n-tooltip>
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button :loading="imageSt.loading.value" @click="imageSt.upload()" size="small">
            {{ t('maa.crop.upload') }}
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.upload') }}
      </n-tooltip>
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button
            :loading="imageSt.loading.value"
            :disabled="!imageSt.data.value"
            @click="imageSt.download()"
            size="small"
          >
            {{ t('maa.crop.download') }}
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.download') }}
      </n-tooltip>
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button @click="controlSt.viewport.value.reset()" size="small">
            {{ t('maa.crop.reset-viewport') }}
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.reset-viewport') }}
      </n-tooltip>
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button @click="controlSt.cropCeil()" size="small"> {{ t('maa.crop.ceil') }} </n-button>
        </template>
        {{ t('maa.crop.tooltip.ceil') }}
      </n-tooltip>
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button @click="controlSt.cropBound()" :disabled="!imageSt.data.value" size="small">
            {{ t('maa.crop.bound') }}
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.bound') }}
      </n-tooltip>
      <n-tooltip trigger="hover">
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
      </n-tooltip>
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button @click="toggleShow('settings')" size="small">
            {{ t('maa.crop.settings') }}
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.settings') }}
      </n-tooltip>
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button @click="toggleShow('tool')" size="small"> {{ t('maa.crop.tools') }} </n-button>
        </template>
        {{ t('maa.crop.tooltip.tools') }}
      </n-tooltip>
    </n-flex>
    <n-flex align="center">
      <n-flex align="center">
        ROI
        {{ controlSt.roiDisp() }}
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button @click="controlSt.copyRoi()" size="small"> {{ t('maa.crop.copy') }} </n-button>
          </template>
          {{ t('maa.crop.tooltip.copy-roi') }}
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button @click="controlSt.pasteRoi()" size="small"> {{ t('maa.crop.paste') }} </n-button>
          </template>
          {{ t('maa.crop.tooltip.paste-roi') }}
        </n-tooltip>
      </n-flex>
      <n-flex align="center">
        ROI EX
        {{ controlSt.roiExpandDisp() }}
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button @click="controlSt.copyRoiExpand()" size="small">
              {{ t('maa.crop.copy') }}
            </n-button>
          </template>
          {{ t('maa.crop.tooltip.copy-roi-ex') }}
        </n-tooltip>
      </n-flex>
      <span> {{ t('maa.crop.hint') }} </span>
    </n-flex>
  </n-flex>
</template>
