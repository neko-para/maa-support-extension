<script setup lang="ts">
import { NButton, NCard, NFlex } from 'naive-ui'
import { computed, ref } from 'vue'

import { t } from '../../utils/locale'
import { type NextListScope } from '../states/task'
import NextList from './NextList.vue'

const props = defineProps<{
  items: NextListScope[]
}>()

const done = computed(() => {
  return !!props.items[0].__fin
})
const hide = ref<boolean | null>(null)
</script>

<template>
  <template v-if="items.length === 0">
    <slot></slot>
  </template>
  <template v-else>
    <n-card size="small" v-if="hide === null ? !done : !hide">
      <template #header>
        <n-flex>
          <slot></slot>
          <n-button size="small" @click="hide = true"> {{ t('maa.launch.hide') }} </n-button>
        </n-flex>
      </template>
      <next-list :items="items"></next-list>
    </n-card>
    <n-flex v-else>
      <slot></slot>
      <n-button size="small" @click="hide = false"> {{ t('maa.launch.show') }} </n-button>
    </n-flex>
  </template>
</template>
