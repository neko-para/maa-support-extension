<script setup lang="ts">
import { NFlex, NScrollbar } from 'naive-ui'

import ControllerFragment from '../components/ControllerFragment.vue'
import InterfaceFragment from '../components/InterfaceFragment.vue'
import JsonCode from '../components/JsonCode.vue'
import ResourceFragment from '../components/ResourceFragment.vue'
import { controlViewState, globalState, localState } from '../states/config'
</script>

<template>
  <n-flex vertical>
    <interface-fragment></interface-fragment>
    <resource-fragment></resource-fragment>
    <controller-fragment></controller-fragment>
  </n-flex>
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
