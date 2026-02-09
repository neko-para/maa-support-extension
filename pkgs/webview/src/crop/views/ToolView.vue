<script setup lang="ts">
import { NButton, NCard, NFlex, NInputNumber, NSelect, NSwitch, NText } from 'naive-ui'
import { computed, ref } from 'vue'

import JsonCode from '../../components/JsonCode.vue'
import { t } from '../../utils/locale'
import ColorBox from '../components/ColorBox.vue'
import RoiEdit from '../components/RoiEdit.vue'
import { hostState } from '../state'
import * as pickSt from '../states/pick'
import * as matchSt from '../states/quickMatch'
import * as recoSt from '../states/reco'
import * as settingsSt from '../states/settings'

const drawOptions = ['all', 'best', 'filtered'].map(x => ({ value: x, label: x }))

const srcRoi = ref<maa.Rect | undefined>([0, 0, 0, 0])
const destRoi = ref<maa.Rect | undefined>([0, 0, 0, 0])
const dltRoi = computed(() => {
  if (srcRoi.value && destRoi.value) {
    return Array.from(
      { length: 4 },
      (_, idx) => destRoi.value![idx] - srcRoi.value![idx]
    ) as maa.Rect
  }
  return undefined
})
</script>

<template>
  <n-flex vertical>
    <n-card :title="t('maa.crop.tools.pick-color')" size="small">
      <template #header-extra>
        <n-button v-if="!pickSt.picking.value" size="small" @click="pickSt.start()">
          {{ t('maa.control.start') }}
        </n-button>
        <n-button v-else size="small" @click="pickSt.picking.value = false">
          {{ t('maa.control.stop') }}
        </n-button>
      </template>

      <template v-if="pickSt.color.value">
        <n-flex>
          <color-box :color="`rgb(${pickSt.color.value.join(',')})`"></color-box>
          <n-button size="small" @click="pickSt.copyCss()">
            {{ pickSt.cssText() }}
          </n-button>
          <n-button size="small" @click="pickSt.copyArray(0)">
            rgb: {{ pickSt.arrayText(0) }}
          </n-button>
          <n-button size="small" @click="pickSt.copyHsv()"> hsv: {{ pickSt.hsvText() }} </n-button>
          <n-button size="small" @click="pickSt.copyArray(hostState.pickColorThreshold ?? 10)">
            upper: {{ pickSt.arrayText(hostState.pickColorThreshold ?? 10) }}
          </n-button>
          <n-button size="small" @click="pickSt.copyArray(-(hostState.pickColorThreshold ?? 10))">
            lower: {{ pickSt.arrayText(-(hostState.pickColorThreshold ?? 10)) }}
          </n-button>
        </n-flex>
      </template>
    </n-card>

    <n-card :title="t('maa.crop.tools.roi-offset')" size="small">
      <n-flex vertical>
        <roi-edit v-model:value="srcRoi"></roi-edit>
        <roi-edit v-model:value="destRoi"></roi-edit>
        <roi-edit :value="dltRoi" readonly hide-use></roi-edit>
      </n-flex>
    </n-card>

    <n-card :title="t('maa.crop.tools.quick-match')" size="small">
      <template #header-extra>
        <n-flex>
          <n-button
            size="small"
            :loading="matchSt.loading.value"
            @click="matchSt.perform('requestOCR')"
          >
            {{ t('maa.crop.tools.quick-match-ocr') }}
          </n-button>
          <n-button
            size="small"
            :loading="matchSt.loading.value"
            @click="matchSt.perform('requestTemplateMatch')"
          >
            {{ t('maa.crop.tools.quick-match-tmpl') }}
          </n-button>
          <n-input-number
            :value="settingsSt.templateMatchThreshold.eff"
            @update:value="
              v => {
                settingsSt.templateMatchThreshold.val = v ?? undefined
              }
            "
            :min="0"
            :max="1"
            :step="0.01"
            placeholder=""
            size="small"
            style="width: 90px"
          />
        </n-flex>
      </template>

      <template v-if="matchSt.result">
        <n-flex vertical>
          <n-flex align="center">
            <n-switch v-model:value="matchSt.draw.value"> </n-switch>
            <n-text> {{ t('maa.crop.tools.draw') }} </n-text>

            <div style="flex: 1"></div>

            <n-switch v-model:value="matchSt.onlyRec.value"> </n-switch>
            <n-text> only_rec </n-text>

            <n-switch v-model:value="matchSt.greenMask.value"> </n-switch>
            <n-text> green_mask </n-text>

            <div>
              <n-select
                :options="
                  [10001, 3, 5].map(v => ({
                    label: `${v}`,
                    value: v
                  }))
                "
                v-model:value="matchSt.method.value"
                size="small"
                style="width: 90px"
              ></n-select>
            </div>
            <n-text> method </n-text>
          </n-flex>
          <n-text> {{ t('maa.crop.tools.draw-mode') }} </n-text>
          <n-select
            v-model:value="matchSt.drawType.value"
            :options="drawOptions"
            size="small"
          ></n-select>
          <json-code :code="matchSt.result.value ?? ''"></json-code>
        </n-flex>
      </template>
    </n-card>

    <n-card v-if="!hostState.isMAA" :title="t('maa.crop.tools.quick-reco')" size="small">
      <template #header-extra>
        <n-button size="small" :loading="recoSt.loading.value" @click="recoSt.perform()">
          {{ t('maa.control.launch') }}
        </n-button>
      </template>

      <template v-if="recoSt.result">
        <n-flex vertical>
          <n-flex>
            <n-switch v-model:value="recoSt.draw.value"> </n-switch>
            <n-text> {{ t('maa.crop.tools.draw') }} </n-text>
          </n-flex>
          <n-text> {{ t('maa.crop.tools.draw-mode') }} </n-text>
          <n-select
            v-model:value="recoSt.drawType.value"
            :options="drawOptions"
            size="small"
          ></n-select>
          <json-code :code="recoSt.result.value ?? ''"></json-code>
        </n-flex>
      </template>
    </n-card>
  </n-flex>
</template>
