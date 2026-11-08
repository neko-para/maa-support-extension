<script setup lang="ts">
import { default as CancelOutlined } from '@vicons/material/es/CancelOutlined'
import { default as CheckCircleOutlined } from '@vicons/material/es/CheckCircleOutlined'
import { default as PlayArrowOutlined } from '@vicons/material/es/PlayArrowOutlined'
import {
  NAlert,
  NButton,
  NFlex,
  NIcon,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSwitch,
  NText
} from 'naive-ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import Tooltip from '../../components/AppTooltip.vue'
import JsonCode from '../../components/JsonCode.vue'
import { t } from '../../utils/locale'
import CopyChip from '../components/CopyChip.vue'
import ParamRow from '../components/ParamRow.vue'
import RecoDetail from '../components/RecoDetail.vue'
import { hostState } from '../state'
import * as controlSt from '../states/control'
import * as drawResultSt from '../states/drawResult'
import * as greenMaskSt from '../states/greenMask'
import * as imageSt from '../states/image'
import * as pickSt from '../states/pick'
import * as matchSt from '../states/quickMatch'
import * as recoSt from '../states/reco'
import * as runHistorySt from '../states/runHistory'
import * as settingsSt from '../states/settings'
import {
  type TestTarget,
  clearFlash,
  flashSection,
  nodeRoiSource,
  pipelineVersion,
  revealSection,
  runRequest,
  testTarget
} from '../states/visible'
import { useCopy } from '../utils/copy'
import { colorMatchSnippet, ocrSnippet, templateMatchSnippet } from '../utils/pipelineSnippet'
import { summarize } from '../utils/recoDetail'

const pickThreshold = computed(() => hostState.value.pickColorThreshold ?? 10)
const hasImage = computed(() => !!imageSt.data.value)

/**
 * MAA 模式不支持节点试跑；但外部（启动面板）送来的节点识别详情仍要能看，
 * 所以有结果时保留「节点」目标，只禁用运行。
 */
const nodeAvailable = computed(() => !hostState.value.isMAA || recoSt.ran.value)

const target = computed<TestTarget>({
  get: () => (testTarget.value === 'node' && !nodeAvailable.value ? 'template' : testTarget.value),
  set: value => {
    testTarget.value = value
  }
})

const targets = computed(() => {
  const list: { value: TestTarget; label: string }[] = [
    { value: 'template', label: t('maa.crop.test.target-template') },
    { value: 'ocr', label: 'OCR' },
    { value: 'color', label: t('maa.crop.test.target-color') }
  ]
  if (nodeAvailable.value) {
    list.push({ value: 'node', label: t('maa.crop.test.target-node') })
  }
  return list
})

// 括号里是 pipeline 里实际写的 method 值，方便对照 JSON
const templateMatchMethods = computed(() => [
  { value: 5 as const, label: 'CCOEFF_NORMED (5)' },
  { value: 3 as const, label: 'CCORR_NORMED (3)' },
  { value: 10001 as const, label: `SQDIFF_NORMED ${t('maa.crop.test.method-inverted')} (10001)` }
])

/** 当前识别范围的人话描述：用户需要知道识别究竟跑在哪片区域上 */
const scopeText = computed(() => {
  const roi = controlSt.requestRoi()
  return roi[2] > 0 && roi[3] > 0
    ? t('maa.crop.test.scope-roi', roi.join(', '))
    : t('maa.crop.test.scope-whole')
})

const targetHint = computed(() => {
  switch (target.value) {
    case 'template':
      return t('maa.crop.test.hint-template', scopeText.value)
    case 'ocr':
      return t('maa.crop.test.hint-ocr', scopeText.value)
    case 'color':
      return t('maa.crop.test.hint-color', scopeText.value)
    case 'node':
      // ROI 来源随选择变化：画布选区时把当前框值显示出来，和算法类目标对齐
      return nodeRoiSource.value === 'canvas'
        ? t('maa.crop.test.hint-node-canvas', scopeText.value)
        : t('maa.crop.test.hint-node')
  }
  return ''
})

const runLabel = computed(() => {
  switch (target.value) {
    case 'template':
      return t('maa.crop.test.run-template')
    case 'ocr':
      return t('maa.crop.test.run-ocr')
    case 'color':
      return t('maa.crop.test.run-color')
    case 'node':
      return t('maa.crop.test.run-node')
  }
  return ''
})

const running = computed(() =>
  target.value === 'node' ? recoSt.loading.value : matchSt.loading.value
)
const runDisabledReason = computed(() => {
  if (!hasImage.value) {
    return t('maa.crop.test.need-image')
  }
  if (target.value === 'node' && hostState.value.isMAA) {
    return t('maa.crop.test.node-maa')
  }
  if (target.value === 'color' && !pickSt.recommendedColors.value) {
    return t('maa.crop.tools.color-source-empty')
  }
  return null
})
const canRun = computed(() => runDisabledReason.value === null)

// ---------- 最近运行 ----------

/** 这次运行对应的已入列记录；结果回来再回填 hit/value */
let pendingEntry: runHistorySt.RunEntry | null = null

function snapshotParams(): Record<string, string | number | boolean> {
  switch (target.value) {
    case 'template':
      return {
        method: matchSt.method.value,
        threshold: settingsSt.templateMatchThreshold.eff,
        greenMask: matchSt.greenMask.value
      }
    case 'ocr':
      return { onlyRec: matchSt.onlyRec.value }
    case 'color':
      return {
        method: pickSt.colorMethod.value,
        count: Math.max(Math.round(matchSt.colorCount.value ?? 1), 1),
        connected: matchSt.colorConnected.value
      }
    case 'node':
      return { roiSource: nodeRoiSource.value }
    default:
      return {}
  }
}

function runTest() {
  if (!canRun.value || running.value) {
    return
  }
  pendingEntry = runHistorySt.record({
    target: target.value,
    params: snapshotParams(),
    roi: target.value === 'node' && nodeRoiSource.value === 'node' ? null : controlSt.requestRoi(),
    hit: null,
    value: null,
    ranAt: Date.now()
  })
  if (target.value === 'node') {
    void recoSt.perform()
  } else {
    void matchSt.run(target.value)
  }
}

// 结果回来回填记录；目标之间共用同一份结果状态，按 kind 对号入座
watch(
  () => [matchSt.result.value, matchSt.resultKind.value, matchSt.error.value] as const,
  () => {
    if (!pendingEntry || pendingEntry.target === 'node') {
      return
    }
    if (matchSt.resultKind.value !== pendingEntry.target) {
      return
    }
    if (matchSt.resultObject.value) {
      const s = summarize(matchSt.resultObject.value)
      pendingEntry.hit = s?.hit ?? false
      pendingEntry.value = s?.value ?? null
    } else if (matchSt.error.value) {
      pendingEntry.hit = false
    }
  }
)
watch(
  () => [recoSt.result.value, recoSt.error.value, recoSt.ran.value] as const,
  () => {
    if (!pendingEntry || pendingEntry.target !== 'node' || !recoSt.ran.value) {
      return
    }
    if (recoSt.resultObject.value) {
      const s = summarize(recoSt.resultObject.value)
      pendingEntry.hit = s?.hit ?? false
      pendingEntry.value = s?.value ?? null
    } else if (recoSt.error.value) {
      pendingEntry.hit = false
    }
  }
)

/** 一条记录的紧凑参数串（目标前缀留给列表里的徽标） */
function entryParamsText(e: runHistorySt.RunEntry): string {
  const p = e.params
  switch (e.target) {
    case 'template':
      return `m${p.method} · th ${p.threshold}${p.greenMask ? ' · 绿' : ''}`
    case 'ocr':
      return p.onlyRec ? 'only_rec' : 'detect'
    case 'color':
      return `m${p.method} · c${p.count}${p.connected ? ' · conn' : ''}`
    case 'node':
      return p.roiSource === 'canvas' ? t('maa.crop.test.roi-canvas') : t('maa.crop.test.roi-node')
    default:
      return ''
  }
}

const targetLabel = computed<Record<runHistorySt.RunTarget, string>>(() => ({
  template: t('maa.crop.test.target-template'),
  ocr: 'OCR',
  color: t('maa.crop.test.target-color'),
  node: t('maa.crop.test.target-node')
}))

/** 点一条记录：回填该目标使用的参数并切到对应页签 */
function applyEntry(e: runHistorySt.RunEntry) {
  target.value = e.target
  const p = e.params
  switch (e.target) {
    case 'template':
      matchSt.method.value = p.method as typeof matchSt.method.value
      settingsSt.templateMatchThreshold.val = p.threshold as number
      matchSt.greenMask.value = p.greenMask as boolean
      break
    case 'ocr':
      matchSt.onlyRec.value = p.onlyRec as boolean
      break
    case 'color':
      pickSt.colorMethod.value = p.method as typeof pickSt.colorMethod.value
      matchSt.colorCount.value = p.count as number
      matchSt.colorConnected.value = p.connected as boolean
      break
    case 'node':
      nodeRoiSource.value = p.roiSource as typeof nodeRoiSource.value
      break
  }
}

const testResult = computed(() => {
  if (target.value === 'node') {
    return {
      detail: recoSt.resultObject.value,
      raw: recoSt.result.value,
      ran: recoSt.ran.value,
      error: recoSt.error.value
    }
  }
  const mine = matchSt.resultKind.value === target.value
  return {
    detail: mine ? matchSt.resultObject.value : null,
    raw: mine ? matchSt.result.value : null,
    ran: mine,
    error: matchSt.activeKind.value === target.value ? matchSt.error.value : null
  }
})
const testSummary = computed(() =>
  testResult.value.detail ? summarize(testResult.value.detail) : null
)
// 目标没有结果时画布上的旧框必须清掉：绘制已脱离组件生命周期，不能依赖卸载清空
watch(
  () => testResult.value.detail,
  detail => {
    if (!detail) {
      drawResultSt.reset()
    }
  }
)
// 画布上的结果框走 drawResult：收起区块/切面板不丢绘制，开关只控制可见性
const showOnCanvas = computed({
  get: () => drawResultSt.visible.value,
  set: value => {
    drawResultSt.visible.value = value
  }
})
const showJson = ref(false)

/** 运行前的「实际生效值」一行：ROI + 当前目标的全部参数，不猜 */
const effLine = computed(() => {
  const roi = controlSt.requestRoi()
  const roiText = `ROI [${roi.join(', ')}]`
  switch (target.value) {
    case 'template': {
      const parts = [
        roiText,
        `method ${matchSt.method.value}`,
        `threshold ${settingsSt.templateMatchThreshold.eff}`
      ]
      if (matchSt.greenMask.value) {
        parts.push('green_mask')
      }
      return parts.join(' · ')
    }
    case 'ocr': {
      const parts = [roiText]
      if (matchSt.onlyRec.value) {
        parts.push('only_rec')
      }
      return parts.join(' · ')
    }
    case 'color':
      return [
        roiText,
        `method ${pickSt.colorMethod.value}`,
        `count ${Math.max(Math.round(matchSt.colorCount.value ?? 1), 1)}`,
        `connected ${matchSt.colorConnected.value}`
      ].join(' · ')
    case 'node':
      return nodeRoiSource.value === 'canvas'
        ? `${roiText}（画布选区）`
        : t('maa.crop.test.eff-node-roi')
    default:
      return null
  }
})

/** 复制当前目标实际使用的参数为 pipeline 片段（节点目标没有可复制的手动参数） */
const { copied: paramsCopied, copy: copyParamsText } = useCopy()
function copyRunParams() {
  const roi = controlSt.requestRoi()
  switch (target.value) {
    case 'template':
      copyParamsText(
        templateMatchSnippet(
          pipelineVersion.value,
          roi,
          settingsSt.templateMatchThreshold.eff,
          matchSt.method.value,
          matchSt.greenMask.value
        )
      )
      return
    case 'ocr':
      copyParamsText(ocrSnippet(pipelineVersion.value, roi, matchSt.onlyRec.value))
      return
    case 'color': {
      const ranges = pickSt.effRanges(pickThreshold.value)
      if (!ranges) {
        return
      }
      copyParamsText(
        colorMatchSnippet(
          pipelineVersion.value,
          roi,
          pickSt.colorMethod.value,
          ranges.lower,
          ranges.upper,
          Math.max(Math.round(matchSt.colorCount.value ?? 1), 1),
          matchSt.colorConnected.value
        )
      )
    }
  }
}

// 只有烘焙进图像的绿色才会进入保存的模板；画布上未应用的笔画不算
const greenMaskFromImage = computed(() => !!greenMaskSt.appliedFrom.value)

const colorSourceText = computed(() => {
  const base = t(
    'maa.crop.tools.color-source',
    `${pickSt.samplePoints.value.length}`,
    colorMethodLabel.value[pickSt.colorMethod.value],
    `${pickThreshold.value}`
  )
  return pickSt.customRange.value ? `${base} · ${t('maa.crop.pick.manual')}` : base
})

const colorMethodLabel = computed<Record<4 | 40 | 6, string>>(() => ({
  4: 'RGB',
  40: 'HSV',
  6: t('maa.crop.tools.gray')
}))

function gotoPick() {
  revealSection('pick')
  if (hasImage.value) {
    pickSt.start()
  }
}

// 跨面板触发的运行（颜色面板「用此色测试」）；切目标已随 runRequest 完成
watch(runRequest, () => runTest())

function onKeyDown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    revealSection('test')
    runTest()
  }
}
onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

// 「跳转」标记：闪烁一下根容器即可（面板内没有可折叠的子区块）
const flashing = ref(false)
let flashTimer: ReturnType<typeof setTimeout> | undefined
watch(flashSection, section => {
  if (section !== 'test') {
    return
  }
  flashing.value = true
  globalThis.clearTimeout(flashTimer)
  flashTimer = globalThis.setTimeout(() => {
    flashing.value = false
  }, 1200)
  clearFlash()
})
</script>

<template>
  <div class="test-panel" :class="{ 'panel-flash': flashing }">
    <n-radio-group v-model:value="target" size="small" class="segmented">
      <n-radio-button
        v-for="opt in targets"
        :key="opt.value"
        :value="opt.value"
        :label="opt.label"
      ></n-radio-button>
    </n-radio-group>
    <n-text depth="3" class="hint">{{ targetHint }}</n-text>

    <div v-if="target !== 'node'" class="param-grid">
      <template v-if="target === 'template'">
        <param-row
          :label="t('maa.crop.test.threshold')"
          field="threshold"
          :tooltip="t('maa.crop.tooltip.threshold')"
        >
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
            size="small"
            style="width: 110px"
          />
        </param-row>
        <param-row
          :label="t('maa.crop.test.method')"
          field="method"
          :tooltip="t('maa.crop.tooltip.match-method')"
        >
          <n-select
            v-model:value="matchSt.method.value"
            :options="templateMatchMethods"
            :consistent-menu-width="false"
            size="small"
            style="width: 210px"
          />
        </param-row>
        <param-row
          :label="t('maa.crop.test.green-mask')"
          field="green_mask"
          :tooltip="t('maa.crop.tooltip.green-mask')"
        >
          <n-switch v-model:value="matchSt.greenMask.value" size="small" />
          <n-text v-if="greenMaskFromImage" depth="3" class="hint">
            {{ t('maa.crop.tools.green-mask-source') }}
          </n-text>
        </param-row>
      </template>

      <template v-else-if="target === 'ocr'">
        <param-row
          :label="t('maa.crop.test.only-rec')"
          field="only_rec"
          :tooltip="t('maa.crop.tooltip.only-rec')"
        >
          <n-switch v-model:value="matchSt.onlyRec.value" size="small" />
        </param-row>
      </template>

      <template v-else-if="target === 'color'">
        <param-row :label="t('maa.crop.test.color-range')" field="lower / upper">
          <template v-if="pickSt.recommendedColors.value">
            <n-text>{{ colorSourceText }}</n-text>
            <n-button text type="primary" size="small" @click="revealSection('pick')">
              {{ t('maa.crop.test.adjust') }}
            </n-button>
          </template>
          <template v-else>
            <n-text depth="3">{{ t('maa.crop.tools.color-source-empty') }}</n-text>
            <n-button size="tiny" :disabled="!hasImage" @click="gotoPick()">
              {{ t('maa.crop.test.goto-pick') }}
            </n-button>
          </template>
        </param-row>
        <param-row
          :label="t('maa.crop.test.color-count')"
          field="count"
          :tooltip="t('maa.crop.tooltip.color-count')"
        >
          <n-input-number
            v-model:value="matchSt.colorCount.value"
            :min="1"
            :precision="0"
            size="small"
            style="width: 110px"
          />
        </param-row>
        <param-row
          :label="t('maa.crop.test.color-connected')"
          field="connected"
          :tooltip="t('maa.crop.tooltip.color-connected')"
        >
          <n-switch v-model:value="matchSt.colorConnected.value" size="small" />
        </param-row>
      </template>
    </div>

    <!-- 节点试跑的 ROI 来源：显式选择，避免画布 ROI 画着却不生效 -->
    <div v-if="target === 'node'" class="param-grid">
      <param-row
        :label="t('maa.crop.test.roi-source')"
        field="roi"
        :tooltip="t('maa.crop.tooltip.roi-source')"
      >
        <n-radio-group v-model:value="nodeRoiSource" size="small" class="segmented">
          <n-radio-button value="node" :label="t('maa.crop.test.roi-node')" />
          <n-radio-button value="canvas" :label="t('maa.crop.test.roi-canvas')" />
        </n-radio-group>
      </param-row>
    </div>

    <!-- 生效值常驻一行：跑之前先看实际会用的参数 -->
    <n-text v-if="effLine" depth="3" class="hint eff-line">{{ effLine }}</n-text>

    <n-flex align="center" :size="8">
      <Tooltip trigger="hover">
        <template #trigger>
          <!-- 禁用态按钮不派发鼠标事件，套一层 span 保证 tooltip 仍可展示 -->
          <span style="display: inline-flex">
            <n-button
              type="primary"
              size="small"
              :loading="running"
              :disabled="!canRun"
              @click="runTest()"
            >
              <template #icon>
                <n-icon><play-arrow-outlined></play-arrow-outlined></n-icon>
              </template>
              {{ runLabel }}
            </n-button>
          </span>
        </template>
        {{ runDisabledReason ?? t('maa.crop.tooltip.run-test') }}
      </Tooltip>
      <kbd class="kbd">Ctrl + Enter</kbd>
      <div style="flex: 1"></div>
      <Tooltip v-if="target !== 'node'" trigger="hover">
        <template #trigger>
          <n-button size="small" quaternary @click="copyRunParams()">
            {{ paramsCopied ? t('maa.crop.copied') : t('maa.crop.test.copy-params') }}
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.copy-params') }}
      </Tooltip>
    </n-flex>
    <n-text v-if="target === 'node'" depth="3" class="hint">
      {{ t('maa.crop.reco.agent-hint') }}
    </n-text>

    <n-alert v-if="testResult.error" type="error" :show-icon="false" class="compact-alert">
      {{ testResult.error }}
    </n-alert>

    <template v-if="testResult.detail && testSummary">
      <div class="result-line" :class="testSummary.hit ? 'is-hit' : 'is-miss'">
        <n-icon size="18">
          <check-circle-outlined v-if="testSummary.hit"></check-circle-outlined>
          <cancel-outlined v-else></cancel-outlined>
        </n-icon>
        <strong>{{ testSummary.hit ? t('maa.crop.test.hit') : t('maa.crop.test.miss') }}</strong>
        <span class="result-meta">{{ testSummary.algorithm }}</span>
        <span v-if="testSummary.value" class="result-value">
          {{ testSummary.hit ? '' : t('maa.crop.test.best-candidate') }}{{ testSummary.value }}
        </span>
        <div style="flex: 1"></div>
        <copy-chip
          v-if="testSummary.box"
          label="box"
          :value="testSummary.box.join(', ')"
          :text="JSON.stringify(testSummary.box)"
          :tooltip="t('maa.crop.tooltip.copy-box')"
        ></copy-chip>
      </div>
      <n-flex align="center" justify="space-between">
        <n-flex align="center" :size="6">
          <n-switch v-model:value="showOnCanvas" size="small" />
          <n-text>{{ t('maa.crop.test.show-on-canvas') }}</n-text>
        </n-flex>
        <n-button text size="small" @click="showJson = !showJson">
          {{ showJson ? t('maa.crop.test.hide-json') : t('maa.crop.test.show-json') }}
        </n-button>
      </n-flex>
      <reco-detail :key="target" :detail="testResult.detail" :draw="showOnCanvas"></reco-detail>
      <json-code v-if="showJson && testResult.raw" :code="testResult.raw"></json-code>
    </template>
    <n-text v-else-if="testResult.ran && !testResult.error" depth="3">
      {{ t('maa.crop.reco.no-result') }}
    </n-text>

    <!-- 最近 5 次运行：点击回填参数 -->
    <div v-if="runHistorySt.entries.value.length" class="run-history">
      <n-flex align="center" :size="6">
        <n-text depth="3" class="hint">{{ t('maa.crop.test.recent-runs') }}</n-text>
        <div style="flex: 1"></div>
        <n-button text size="tiny" @click="runHistorySt.clear()">
          {{ t('maa.crop.test.clear-runs') }}
        </n-button>
      </n-flex>
      <div
        v-for="(entry, i) in runHistorySt.entries.value"
        :key="i"
        class="run-entry"
        @click="applyEntry(entry)"
      >
        <span
          class="run-badge"
          :class="{
            'is-pending': entry.hit === null,
            'is-hit': entry.hit === true,
            'is-miss': entry.hit === false
          }"
        >
          {{ entry.hit === null ? '…' : entry.hit ? '✓' : '✗' }}
        </span>
        <span class="run-target">{{ targetLabel[entry.target] }}</span>
        <span class="run-params">{{ entryParamsText(entry) }}</span>
        <span v-if="entry.value" class="run-value">{{ entry.value }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.test-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px 12px;
}

.panel-flash {
  animation: section-flash 1.1s ease-out;
  border-radius: 3px;
}

@keyframes section-flash {
  0% {
    background: var(--vscode-textBlockQuote-background, rgba(128, 128, 128, 0.18));
    box-shadow: inset 0 0 0 1px var(--vscode-focusBorder, #007fd4);
  }
  70% {
    background: var(--vscode-textBlockQuote-background, rgba(128, 128, 128, 0.18));
    box-shadow: inset 0 0 0 1px var(--vscode-focusBorder, #007fd4);
  }
  100% {
    background: transparent;
    box-shadow: inset 0 0 0 1px transparent;
  }
}

.segmented {
  display: flex;
}

.segmented :deep(.n-radio-button) {
  flex: 1 1 0;
  min-width: 0;
  padding: 0 6px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.param-grid {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: 14px;
  row-gap: 8px;
  align-items: center;
}

.hint {
  font-size: 12px;
  line-height: 1.5;
}

.eff-line {
  font-family: var(--vscode-editor-font-family, monospace);
}

.result-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid currentColor;
  background: color-mix(in srgb, currentColor 8%, transparent);
}

.result-line.is-hit {
  color: var(--vscode-testing-iconPassed, #73c991);
}

.result-line.is-miss {
  color: var(--vscode-testing-iconFailed, #f14c4c);
}

.result-meta,
.result-value {
  color: var(--vscode-foreground, inherit);
}

.result-value {
  font-family: var(--vscode-editor-font-family, monospace);
}

.compact-alert {
  font-size: 12px;
}

.kbd {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  color: var(--vscode-descriptionForeground, gray);
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.4));
}

.run-history {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.3));
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.run-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 3px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
}

.run-entry:hover {
  background: var(--vscode-toolbar-hoverBackground, rgba(128, 128, 128, 0.18));
}

.run-badge {
  width: 16px;
  text-align: center;
  font-weight: 700;
}

.run-badge.is-hit {
  color: var(--vscode-testing-iconPassed, #73c991);
}

.run-badge.is-miss {
  color: var(--vscode-testing-iconFailed, #f14c4c);
}

.run-badge.is-pending {
  color: var(--vscode-descriptionForeground, gray);
}

.run-target {
  flex: 0 0 auto;
}

.run-params {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--vscode-descriptionForeground, gray);
  font-family: var(--vscode-editor-font-family, monospace);
}

.run-value {
  font-family: var(--vscode-editor-font-family, monospace);
}
</style>
