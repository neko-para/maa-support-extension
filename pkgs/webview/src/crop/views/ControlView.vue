<script setup lang="ts">
import { NButton, NFlex, NTooltip } from 'naive-ui'

import { t } from '../../utils/locale'
import * as controlSt from '../states/control'
import * as imageSt from '../states/image'
import { toggleShow } from '../states/visible'
</script>

<template>
  <n-flex align="center">
    <span> {{ t('maa.crop.hint') }} </span>
    <n-button :loading="imageSt.loading.value" @click="imageSt.screencap()">
      {{ t('maa.crop.screencap') }}
    </n-button>
    <n-button :loading="imageSt.loading.value" @click="imageSt.upload()">
      {{ t('maa.crop.upload') }}
    </n-button>
    <n-button :loading="imageSt.loading.value" @click="imageSt.download()">
      {{ t('maa.crop.download') }}
    </n-button>
    <n-button @click="controlSt.viewport.value.reset()">
      {{ t('maa.crop.reset-viewport') }}
    </n-button>
    <n-button @click="controlSt.cropCeil()"> {{ t('maa.crop.ceil') }} </n-button>
    <n-button @click="controlSt.cropBound()"> {{ t('maa.crop.bound') }} </n-button>

    <n-tooltip trigger="hover">
      <template #trigger>
        <n-button @click="controlSt.copyRoi()"> ROI </n-button>
      </template>

      {{ controlSt.roiText() }}
    </n-tooltip>
    <n-tooltip trigger="hover">
      <template #trigger>
        <n-button @click="controlSt.copyRoiExpand()"> ROI EX </n-button>
      </template>

      {{ controlSt.roiExpandText() }}
    </n-tooltip>

    <n-button @click="toggleShow('settings')"> {{ t('maa.crop.settings') }} </n-button>
    <n-button @click="toggleShow('tool')"> {{ t('maa.crop.tools') }} </n-button>
  </n-flex>
</template>
