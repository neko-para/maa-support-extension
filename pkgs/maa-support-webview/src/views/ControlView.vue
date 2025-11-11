<script setup lang="ts">
import { NFlex, NScrollbar } from 'naive-ui'

import JsonCode from '../components/JsonCode.vue'
import ControllerFragment from '../components/control/ControllerFragment.vue'
import InterfaceFragment from '../components/control/InterfaceFragment.vue'
import LaunchFragment from '../components/control/LaunchFragment.vue'
import ResourceFragment from '../components/control/ResourceFragment.vue'
import TaskFragment from '../components/control/TaskFragment.vue'
import { controlViewState, globalState, localState } from '../states/config'
</script>

<template>
  <n-flex vertical>
    <interface-fragment></interface-fragment>
    <resource-fragment></resource-fragment>
    <controller-fragment></controller-fragment>
    <task-fragment></task-fragment>
    <launch-fragment></launch-fragment>
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
