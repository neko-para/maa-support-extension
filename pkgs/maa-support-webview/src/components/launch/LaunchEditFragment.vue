<script setup lang="ts">
import type { LaunchViewState } from '@maaxyz/maa-support-types'
import { NCard, NFlex } from 'naive-ui'
import { type ShallowRef, inject, onMounted, ref, shallowRef } from 'vue'

import { request, useSubsribe } from '../../utils/api'

const launchState = inject<ShallowRef<LaunchViewState>>(
  'LaunchState',
  shallowRef<LaunchViewState>({ id: '' })
)

const launchMessages = ref<unknown[]>([])

useSubsribe('launch/message', ({ id, msg }) => {
  if (id !== launchState.value.id) {
    return
  }
  launchMessages.value.push(msg)
  // console.log(msg)
})

onMounted(async () => {
  if (!launchState.value.runtime) {
    return
  }
  const succ = await request('/launch/create', {
    pageId: launchState.value.id,
    runtime: launchState.value.runtime
  })
  if (!succ?.succ) {
    console.log(succ?.error)
    return
  }
  await request('/launch/start', {
    pageId: launchState.value.id
  })
})
</script>

<template>
  <n-card v-if="launchState.runtime" size="small">
    <n-flex vertical>
      {{ launchMessages }}
      {{ launchState.runtime.root }}
    </n-flex>
  </n-card>
</template>
