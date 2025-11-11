<script setup lang="ts">
import { NFlex, NScrollbar } from 'naive-ui'

import JsonCode from '../components/JsonCode.vue'
import { controlViewState, globalState, localState } from '../states/config'
</script>

<template>
  <n-flex vertical> </n-flex>
  <n-scrollbar style="max-height: 100px">
    <json-code :code="JSON.stringify(globalState)"></json-code>
  </n-scrollbar>
  <n-scrollbar style="max-height: 100px">
    <json-code :code="JSON.stringify(localState)"></json-code>
  </n-scrollbar>
  <n-scrollbar style="max-height: 400px">
    <json-code :code="JSON.stringify(controlViewState)"></json-code>
  </n-scrollbar>
</template>
