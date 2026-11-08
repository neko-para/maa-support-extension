<script setup lang="ts">
import { NText } from 'naive-ui'
import { computed, ref } from 'vue'

import { t } from '../../utils/locale'
import RoiEdit from '../components/RoiEdit.vue'
import { hostState } from '../state'

const roiX = ref<maa.Rect | undefined>([0, 0, 0, 0])
const roiY = ref<maa.Rect | undefined>([0, 0, 0, 0])
const roiSum = computed(() => {
  if (roiX.value && roiY.value) {
    return Array.from({ length: 4 }, (_, idx) => roiY.value![idx]! + roiX.value![idx]!) as maa.Rect
  }
  return undefined
})
const roiDlt = computed(() => {
  if (roiX.value && roiY.value) {
    return Array.from({ length: 4 }, (_, idx) => roiY.value![idx]! - roiX.value![idx]!) as maa.Rect
  }
  return undefined
})
const roiRectMove = computed(() => {
  if (roiX.value && roiY.value) {
    return [
      roiX.value[0] + roiY.value[0],
      roiX.value[1] + roiY.value[1],
      roiY.value[2],
      roiY.value[3]
    ] as maa.Rect
  }
  return undefined
})
</script>

<template>
  <div class="calc-panel">
    <n-text depth="3" class="hint">{{ t('maa.crop.roi-calc.hint') }}</n-text>
    <div class="roi-grid">
      <n-text>ROI 1</n-text>
      <roi-edit v-model:value="roiX"></roi-edit>
      <n-text>ROI 2</n-text>
      <roi-edit v-model:value="roiY"></roi-edit>
      <n-text>1 + 2</n-text>
      <roi-edit :value="roiSum" readonly></roi-edit>
      <n-text>2 - 1</n-text>
      <roi-edit :value="roiDlt" readonly></roi-edit>
      <template v-if="hostState.isMAA">
        <n-text>rect_move</n-text>
        <roi-edit :value="roiRectMove" readonly></roi-edit>
      </template>
    </div>
  </div>
</template>

<style scoped>
.calc-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px 12px;
}

.roi-grid {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: 8px;
  row-gap: 8px;
  align-items: center;
}

.hint {
  font-size: 12px;
  line-height: 1.5;
}
</style>
