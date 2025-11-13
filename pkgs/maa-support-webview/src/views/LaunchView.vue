<script setup lang="ts">
import type { LaunchViewState } from '@maaxyz/maa-support-types'
import { NFlex, NScrollbar } from 'naive-ui'
import { inject, onMounted, provide, ref, shallowRef } from 'vue'

import JsonCode from '../components/JsonCode.vue'
import LaunchEditFragment from '../components/launch/LaunchEditFragment.vue'
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
    <n-flex vertical>
      <launch-edit-fragment></launch-edit-fragment>
      <json-code :code="JSON.stringify(launchState)"></json-code>
    </n-flex>
  </template>
</template>
