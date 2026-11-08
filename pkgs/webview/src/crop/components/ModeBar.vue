<script setup lang="ts">
import { NButton, NFlex, NInputNumber, NText } from 'naive-ui'
import { computed } from 'vue'

import Tooltip from '../../components/AppTooltip.vue'
import { t } from '../../utils/locale'
import * as controlSt from '../states/control'
import * as greenMaskSt from '../states/greenMask'
import * as imageSt from '../states/image'
import { exitMode, mode } from '../states/mode'
import * as pickSt from '../states/pick'
import * as subjectSelectSt from '../states/subjectSelect'
import { Box, Pos, Size } from '../utils/2d'

/**
 * 画布下方的模式条：pointer 模式给 ROI 四数字编辑 + 显式动作；
 * 其他模式给上下文操作（涂绿的撤销/清除、取色的采样数/清空），不再只有一句提示。
 */

const hasImage = computed(() => !!imageSt.data.value)
const hasRoi = computed(() => {
  const size = controlSt.cropBox.value.size
  return Math.abs(size.w) > 0 && Math.abs(size.h) > 0
})
const eff = computed(() => controlSt.requestRoi())

function setRoiField(index: 0 | 1 | 2 | 3, value: number | null) {
  if (value === null || !hasImage.value) {
    return
  }
  // 未框选时输入数字等于从零开始框选：先给一个 1×1 的起点再写入该字段
  const rect = (hasRoi.value ? [...eff.value] : [0, 0, 1, 1]) as [number, number, number, number]
  rect[index] = value
  // w/h 至少 1，坐标收进图像边界由 cropBound 风格的展示回读保证
  rect[2] = Math.max(1, rect[2])
  rect[3] = Math.max(1, rect[3])
  controlSt.cropBox.value = Box.from(Pos.from(rect[0], rect[1]), Size.from(rect[2], rect[3]))
}

const modeName = computed(() => {
  switch (mode.value) {
    case 'mask':
      return t('maa.crop.overlay.mode-masking')
    case 'lasso':
      return t('maa.crop.overlay.mode-lasso')
    case 'pick-rect':
      return t('maa.crop.overlay.mode-selecting')
    case 'pick-point':
      return t('maa.crop.overlay.mode-picking')
    default:
      return null
  }
})

/** 「框选 ROI」也是 ROI 编辑语境：保留四数字输入 + 一句拖拽提示 */
const roiMode = computed(() => mode.value === 'roi')

const sampleCount = computed(() => pickSt.samplePoints.value.length)
const hasUndoStroke = computed(() => greenMaskSt.undoSteps.value > 0)
const hasMaskContent = computed(() => greenMaskSt.hasContent.value)
const lassoDrawing = computed(() => subjectSelectSt.drawing.value)
</script>

<template>
  <div class="modebar" role="toolbar" :aria-label="modeName ?? 'ROI'">
    <!-- pointer / 框选 ROI：ROI 精确编辑 + 显式动作（「⋯」菜单里的取整/限界移到这里） -->
    <template v-if="!modeName">
      <n-flex align="center" :size="6" :wrap="false">
        <n-text v-if="roiMode" depth="3" class="modebar-label">
          {{ t('maa.crop.modebar.roi-draw') }}
        </n-text>
        <n-text depth="3" class="modebar-label">ROI</n-text>
        <n-input-number
          :value="eff[0]"
          :show-button="false"
          :disabled="!hasImage"
          placeholder="x"
          size="small"
          class="modebar-num"
          title="ROI x"
          @update:value="v => setRoiField(0, v)"
        />
        <n-input-number
          :value="eff[1]"
          :show-button="false"
          :disabled="!hasImage"
          placeholder="y"
          size="small"
          class="modebar-num"
          title="ROI y"
          @update:value="v => setRoiField(1, v)"
        />
        <n-input-number
          :value="eff[2]"
          :show-button="false"
          :disabled="!hasImage"
          placeholder="w"
          size="small"
          class="modebar-num"
          title="ROI width"
          @update:value="v => setRoiField(2, v)"
        />
        <n-input-number
          :value="eff[3]"
          :show-button="false"
          :disabled="!hasImage"
          placeholder="h"
          size="small"
          class="modebar-num"
          title="ROI height"
          @update:value="v => setRoiField(3, v)"
        />
        <Tooltip trigger="hover">
          <template #trigger>
            <span style="display: inline-flex">
              <n-button size="tiny" quaternary :disabled="!hasRoi" @click="controlSt.cropCeil()">
                {{ t('maa.crop.more.ceil') }}
              </n-button>
            </span>
          </template>
          {{ t('maa.crop.modebar.ceil') }}
        </Tooltip>
        <Tooltip trigger="hover">
          <template #trigger>
            <span style="display: inline-flex">
              <n-button size="tiny" quaternary :disabled="!hasRoi" @click="controlSt.cropBound()">
                {{ t('maa.crop.more.bound') }}
              </n-button>
            </span>
          </template>
          {{ t('maa.crop.modebar.bound') }}
        </Tooltip>
        <Tooltip trigger="hover">
          <template #trigger>
            <span style="display: inline-flex">
              <n-button
                size="tiny"
                quaternary
                :disabled="!hasRoi && !controlSt.roiUndo.value"
                @click="controlSt.roiUndo.value ? controlSt.undoClearRoi() : controlSt.clearRoi()"
              >
                {{
                  controlSt.roiUndo.value
                    ? t('maa.crop.modebar.undo-clear')
                    : t('maa.crop.modebar.clear')
                }}
              </n-button>
            </span>
          </template>
          {{
            controlSt.roiUndo.value
              ? t('maa.crop.modebar.undo-tip')
              : t('maa.crop.modebar.clear-tip')
          }}
        </Tooltip>
        <n-button v-if="roiMode" size="tiny" secondary @click="exitMode()">
          {{ t('maa.crop.overlay.mode-exit') }}
        </n-button>
      </n-flex>
    </template>

    <!-- 涂绿：撤销笔画 / 清除 -->
    <template v-else-if="mode === 'mask'">
      <n-flex align="center" :size="8" :wrap="false">
        <n-text class="modebar-mode">{{ modeName }}</n-text>
        <n-button size="tiny" :disabled="!hasUndoStroke" @click="greenMaskSt.undo()">
          {{ t('maa.crop.modebar.undo-stroke') }}
        </n-button>
        <n-button size="tiny" :disabled="!hasMaskContent" @click="greenMaskSt.clear()">
          {{ t('maa.crop.modebar.clear-strokes') }}
        </n-button>
        <n-button size="tiny" secondary @click="exitMode()">
          {{ t('maa.crop.overlay.mode-exit') }}
        </n-button>
      </n-flex>
    </template>

    <!-- 圈选主体：只有退出 -->
    <template v-else-if="mode === 'lasso'">
      <n-flex align="center" :size="8" :wrap="false">
        <n-text class="modebar-mode">{{ modeName }}</n-text>
        <n-text v-if="lassoDrawing" depth="3" class="modebar-label">
          {{ t('maa.crop.modebar.lasso-drawing') }}
        </n-text>
        <n-button size="tiny" secondary @click="exitMode()">
          {{ t('maa.crop.overlay.mode-exit') }}
        </n-button>
      </n-flex>
    </template>

    <!-- 取色：采样数 + 清空 -->
    <template v-else>
      <n-flex align="center" :size="8" :wrap="false">
        <n-text class="modebar-mode">{{ modeName }}</n-text>
        <n-text depth="3" class="modebar-label">
          {{ t('maa.crop.pick.badge', `${sampleCount}`) }}
        </n-text>
        <n-button size="tiny" :disabled="sampleCount === 0" @click="pickSt.clearSamplePoints()">
          {{ t('maa.crop.modebar.clear-samples') }}
        </n-button>
        <n-button size="tiny" secondary @click="exitMode()">
          {{ t('maa.crop.overlay.mode-exit') }}
        </n-button>
      </n-flex>
    </template>
  </div>
</template>

<style scoped>
.modebar {
  display: flex;
  align-items: center;
  min-height: 30px;
  padding: 2px 10px;
  border-top: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, transparent));
}

.modebar-label {
  font-size: 12px;
  white-space: nowrap;
}

.modebar-mode {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.modebar-num {
  width: 64px;
}

.modebar-num :deep(input) {
  text-align: center;
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 12px;
}
</style>
