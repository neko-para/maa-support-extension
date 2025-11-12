<script setup lang="ts">
import type { LaunchViewState } from '@maaxyz/maa-support-types'
import { NFlex, NScrollbar } from 'naive-ui'
import { onMounted, ref, shallowRef } from 'vue'

import JsonCode from '../components/JsonCode.vue'
import { controlViewState, globalState, localState } from '../states/config'
import { getPageData } from '../utils/tabs'

const props = defineProps<{
  id: string
}>()

const launchState = shallowRef<LaunchViewState>({
  id: props.id
})

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
      <json-code :code="JSON.stringify(launchState)"></json-code>
    </n-flex>
  </template>
</template>
