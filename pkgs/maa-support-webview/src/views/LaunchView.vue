<script setup lang="ts">
import type { LaunchViewState } from '@maaxyz/maa-support-types'
import { NCard, NFlex } from 'naive-ui'
import { inject, onMounted, provide, ref, shallowRef } from 'vue'

import JsonCode from '../components/JsonCode.vue'
import LaunchStatusFragment from '../components/launch/LaunchStatusFragment.vue'
import { controlViewState, globalState, localState } from '../states/config'
import { getPageData } from '../utils/tabs'

const props = defineProps<{
  id: string
}>()

const launchState = shallowRef<LaunchViewState>({
  id: props.id
})
provide('LaunchState', launchState)

const loaded = ref(false)

onMounted(async () => {
  const data = (await getPageData(props.id)) as LaunchViewState
  launchState.value = {
    ...launchState.value,
    ...data
  }
  loaded.value = true
})
</script>

<template>
  <template v-if="loaded">
    <launch-status-fragment></launch-status-fragment>
  </template>
</template>
