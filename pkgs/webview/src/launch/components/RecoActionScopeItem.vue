<script setup lang="ts">
import { NButton, NCard, NFlex } from 'naive-ui'
import { computed, ref } from 'vue'

import { t } from '../../utils/locale'
import type { ActionScope, RecoScope } from '../states/launch'
import NodeScopeItem from './NodeScopeItem.vue'
import RecoActionButton from './RecoActionButton.vue'

const props = defineProps<{
  item: RecoScope | ActionScope
}>()

const hide = ref<boolean | null>(null)
const done = computed(() => {
  return props.item.status !== 'running'
})
</script>

<template>
  <template v-if="item.childs.length === 0">
    <reco-action-button :item="item"></reco-action-button>
  </template>
  <template v-else>
    <n-card size="small" v-if="hide === null ? !done : !hide">
      <template #header>
        <n-flex>
          <slot></slot>
          <n-button size="small" @click="hide = true"> {{ t('maa.launch.hide') }} </n-button>
        </n-flex>
      </template>
      <n-flex vertical>
        <template v-for="(sub, idx) in item.childs" :key="idx">
          <node-scope-item :item="sub"></node-scope-item>
        </template>
      </n-flex>
    </n-card>
    <n-flex v-else>
      <reco-action-button :item="item"></reco-action-button>
      <n-button v-if="item.childs.length > 0" size="small" @click="hide = false">
        {{ t('maa.launch.show') }}
      </n-button>
    </n-flex>
  </template>
</template>
