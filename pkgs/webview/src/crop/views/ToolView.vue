<script setup lang="ts">
import { NButton, NCard, NCode, NFlex, NSelect, NSwitch, NText } from 'naive-ui'

import * as ocrSt from '../states/ocr'
import * as pickSt from '../states/pick'
import * as recoSt from '../states/reco'

const drawOptions = ['all', 'best', 'filter'].map(x => ({ value: x, label: x }))
</script>

<template>
  <n-flex vertical>
    <n-card title="取色" size="small">
      <template #header-extra>
        <n-button v-if="!pickSt.picking.value" size="small" @click="pickSt.start()">
          开始
        </n-button>
        <n-button v-else size="small" @click="pickSt.picking.value = false"> 停止 </n-button>
      </template>

      <template v-if="pickSt.color.value">
        <n-flex>
          <div
            :style="`width: 28px; height: 28px; background-color: rgb(${pickSt.color.value.join(',')});`"
          ></div>
          <n-button size="small" @click="pickSt.copyCss()">
            {{ pickSt.cssText() }}
          </n-button>
          <n-button size="small" @click="pickSt.copyArray()">
            {{ pickSt.arrayText() }}
          </n-button>
        </n-flex>
      </template>
    </n-card>

    <n-card title="快速OCR" size="small">
      <template #header-extra>
        <n-button size="small" :loading="ocrSt.loading.value" @click="ocrSt.perform()">
          执行
        </n-button>
      </template>

      <template v-if="ocrSt.result">
        <n-flex vertical>
          <n-flex>
            <n-switch v-model:value="ocrSt.draw.value"> </n-switch>
            <n-text> 绘制 </n-text>
          </n-flex>
          <n-text> 绘制类型 </n-text>
          <n-select
            v-model:value="ocrSt.drawType.value"
            :options="drawOptions"
            size="small"
          ></n-select>
          <n-code
            language="json"
            :code="JSON.stringify(ocrSt.resultObject.value, null, 4)"
            word-wrap
          ></n-code>
        </n-flex>
      </template>
    </n-card>

    <n-card title="快速识别" size="small">
      <template #header-extra>
        <n-button size="small" :loading="recoSt.loading.value" @click="recoSt.perform()">
          执行
        </n-button>
      </template>

      <template v-if="recoSt.result">
        <n-flex vertical>
          <n-flex>
            <n-switch v-model:value="recoSt.draw.value"> </n-switch>
            <n-text> 绘制 </n-text>
          </n-flex>
          <n-text> 绘制类型 </n-text>
          <n-select
            v-model:value="recoSt.drawType.value"
            :options="drawOptions"
            size="small"
          ></n-select>
          <n-code
            language="json"
            :code="JSON.stringify(recoSt.resultObject.value, null, 4)"
            word-wrap
          ></n-code>
        </n-flex>
      </template>
    </n-card>
  </n-flex>
</template>
