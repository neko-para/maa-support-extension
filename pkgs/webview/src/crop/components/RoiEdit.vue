<script setup lang="ts">
import { NButton, NFlex, NInput, NText } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { t } from '../../utils/locale'
import * as controlSt from '../states/control'
import { Box, Pos, Size } from '../utils/2d'

const props = defineProps<{
  value?: maa.Rect
  readonly?: boolean
  hideUse?: boolean
}>()

const emits = defineEmits<{
  'update:value': [maa.Rect]
}>()

const cache = ref<string>('[]')
const extracted = computed(() => {
  return controlSt.extractRect(cache.value)
})
watch(
  () => props.value,
  rc => {
    if (rc) {
      cache.value = JSON.stringify(rc)
    }
  },
  {
    immediate: true
  }
)
watch(extracted, rect => {
  if (rect) {
    emits('update:value', rect)
  }
})

function use() {
  console.log(extracted.value)
  if (extracted.value) {
    controlSt.cropBox.value = Box.from(
      Pos.from(extracted.value[0], extracted.value[1]),
      Size.from(extracted.value[2], extracted.value[3])
    )
  }
}

function copy() {
  controlSt.writeClipboard(JSON.stringify(props.value))
}

async function paste() {
  cache.value = await controlSt.readClipboard()
}
</script>

<template>
  <n-flex>
    <div>
      <n-input v-model:value="cache" :readonly="readonly" size="small"></n-input>
    </div>

    <n-button @click="copy" size="small" :disabled="!extracted">
      {{ t('maa.crop.copy') }}
    </n-button>

    <n-button v-if="!readonly" @click="paste" size="small">
      {{ t('maa.crop.paste') }}
    </n-button>

    <n-button v-if="!hideUse" @click="use" size="small" :disabled="!extracted">
      {{ t('maa.crop.use') }}
    </n-button>
  </n-flex>
</template>
