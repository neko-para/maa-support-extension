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
      <n-button :loading="imageSt.loading.value" @click="imageSt.screencap()" size="small">
        {{ t('maa.crop.screencap') }}
      </n-button>
      <n-button :loading="imageSt.loading.value" @click="imageSt.upload()" size="small">
        {{ t('maa.crop.upload') }}
      </n-button>
      <n-button :loading="imageSt.loading.value" @click="imageSt.download()" size="small">
        {{ t('maa.crop.download') }}
      </n-button>
      <n-button @click="controlSt.viewport.value.reset()" size="small">
        {{ t('maa.crop.reset-viewport') }}
      </n-button>
      <n-button @click="controlSt.cropCeil()" size="small"> {{ t('maa.crop.ceil') }} </n-button>
      <n-button @click="controlSt.cropBound()" size="small"> {{ t('maa.crop.bound') }} </n-button>
      <n-button :loading="imageSt.resizing.value" @click="imageSt.resize()" size="small">
        {{ t('maa.crop.resize') }}
      </n-button>

      <n-button @click="toggleShow('settings')" size="small">
        {{ t('maa.crop.settings') }}
      </n-button>
      <n-button @click="toggleShow('tool')" size="small"> {{ t('maa.crop.tools') }} </n-button>
    </n-flex>
    <n-flex align="center">
      <n-flex align="center">
        ROI
        {{ controlSt.roiDisp() }}
        <n-button @click="controlSt.copyRoi()" size="small"> {{ t('maa.crop.copy') }} </n-button>
        <n-button @click="controlSt.pasteRoi()" size="small"> {{ t('maa.crop.paste') }} </n-button>
      </n-flex>
      <n-flex align="center">
        ROI EX
        {{ controlSt.roiExpandDisp() }}
        <n-button @click="controlSt.copyRoiExpand()" size="small">
          {{ t('maa.crop.copy') }}
        </n-button>
      </n-flex>
      <span> {{ t('maa.crop.hint') }} </span>
    </n-flex>
  </n-flex>
</template>
