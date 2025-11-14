<script setup lang="ts">
import { default as CheckOutlined } from '@vicons/material/es/CheckOutlined'
import { default as CloseOutlined } from '@vicons/material/es/CloseOutlined'
import { NButton, NCard, NFlex } from 'naive-ui'

import type { AnyContextScope } from '../../states/launch'
import JsonCode from '../JsonCode.vue'
import LaunchScopeButton from './LaunchScopeButton.vue'
import LaunchScopeListFragment from './LaunchScopeListFragment.vue'

defineProps<{
  scope: AnyContextScope
}>()
</script>

<template>
  <n-card size="small">
    <template #header>
      <n-button size="small">
        {{ `${scope.type === 'next' ? 'N' : scope.type === 'reco' ? 'R' : 'A'} ${scope.msg.name}` }}
      </n-button>
    </template>
    <template v-if="scope.type === 'next'">
      <n-flex>
        <template v-for="(reco, idx) in scope.childs" :key="`reco-${idx}`">
          <launch-scope-button :scope="reco"></launch-scope-button>
        </template>
        <template
          v-for="(reco, idx) in scope.msg.list.slice(scope.childs.length)"
          :key="`wait-${idx}`"
        >
          <n-button size="small" ghost disabled> R {{ reco }} </n-button>
        </template>
      </n-flex>
    </template>
    <template v-else>
      <template v-if="scope.childs.length === 0">
        <template v-if="scope.type === 'reco'">
          <launch-scope-button :scope="scope"></launch-scope-button>
        </template>
        <template v-else-if="scope.type === 'act'">
          <launch-scope-button :scope="scope"></launch-scope-button>
        </template>
      </template>
      <template v-else>
        <n-card size="small">
          <template v-if="scope.type === 'reco'">
            <launch-scope-button :scope="scope"></launch-scope-button>
          </template>
          <template v-else-if="scope.type === 'act'">
            <launch-scope-button :scope="scope"></launch-scope-button>
          </template>
          <launch-scope-list-fragment :scopes="scope.childs"></launch-scope-list-fragment>
        </n-card>
      </template>
    </template>
  </n-card>
</template>
