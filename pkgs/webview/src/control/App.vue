<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { NConfigProvider, NFlex, NScrollbar } from 'naive-ui'

import { useTheme } from '../utils/theme'
import { hostState } from './state'
import ControllerView from './views/ControllerView.vue'
import InterfaceView from './views/InterfaceView.vue'
import LaunchView from './views/LaunchView.vue'
import ResourceView from './views/ResourceView.vue'
import TaskView from './views/TaskView.vue'

const { loaded, theme, themeOverride } = useTheme('view')

hljs.registerLanguage('json', json)
</script>

<template>
  <template v-if="loaded">
    <n-scrollbar>
      <n-config-provider :theme="theme" :theme-overrides="themeOverride" :hljs="hljs">
        <n-flex vertical>
          <interface-view></interface-view>
          <resource-view></resource-view>
          <controller-view></controller-view>
          <task-view v-if="!hostState.isMAA"></task-view>
          <launch-view v-if="!hostState.isMAA"></launch-view>
        </n-flex>
      </n-config-provider>
    </n-scrollbar>
  </template>
</template>
