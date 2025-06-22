<script setup lang="ts">
import { NButton, NFlex, NTooltip } from 'naive-ui'

import * as controlSt from '../states/control'
import * as imageSt from '../states/image'
import { toggleShow } from '../states/visible'
</script>

<template>
  <n-flex>
    <n-button :loading="imageSt.loading.value" @click="imageSt.screencap()"> 截图 </n-button>
    <n-button :loading="imageSt.loading.value" @click="imageSt.upload()"> 上传 </n-button>
    <n-button :loading="imageSt.loading.value" @click="imageSt.download()"> 下载 </n-button>
    <n-button @click="controlSt.viewport.value.reset()"> 重置视野 </n-button>
    <n-button @click="controlSt.cropCeil()"> 取整 </n-button>
    <n-button @click="controlSt.cropBound()"> 边界 </n-button>

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

    <n-button @click="toggleShow('settings')"> 设置 </n-button>
    <n-button @click="toggleShow('tool')"> 工具 </n-button>
  </n-flex>
</template>
