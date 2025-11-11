<script setup lang="ts">
import { NButton, NCard } from 'naive-ui'
import { ref } from 'vue'

import { request } from '../../utils/api'
import { t } from '../../utils/locale'

const canLaunch = ref(true)

async function launch() {
  const runtime = await request('/interface/buildRuntime', {})
  if (runtime?.runtime) {
    console.log(runtime.runtime)
  } else {
    console.log(runtime?.error ?? 'unknown error')
  }
}
</script>

<template>
  <n-card :title="t('maa.control.launch.launch')" size="small">
    <n-button :disabled="!canLaunch" @click="launch" size="small">
      {{ t('maa.control.launch.start') }}
    </n-button>
  </n-card>
</template>
