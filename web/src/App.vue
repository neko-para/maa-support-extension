<script setup lang="ts">
import { NButton } from 'naive-ui'

import { taskList } from './task'
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <div v-for="(node, idx) in taskList.node" :key="idx" class="flex flex-col">
      <div class="flex flex-col gap-2 border p-2">
        <span class="font-bold self-center"> {{ node.pre_hit_task }} </span>
        <template v-for="(reco, ridx) in node.reco_list" :key="ridx">
          <n-button>
            <span v-if="reco.status === 'pending'" class="text-slate-500">
              {{ reco.task }} {{ reco.reco_id ?? '' }}
            </span>
            <span v-else-if="reco.status === 'success'" class="text-green-500">
              {{ reco.task }} {{ reco.reco_id ?? '' }}
            </span>
            <span v-else-if="reco.status === 'failed'" class="text-red-500">
              {{ reco.task }} {{ reco.reco_id ?? '' }}
            </span>
          </n-button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flex {
  display: flex;
}

.flex-wrap {
  flex-wrap: wrap;
}

.flex-col {
  flex-direction: column;
}

.gap-2 {
  gap: 0.5rem;
}

.border {
  border: solid black 1px;
}

.p-2 {
  padding: 0.5rem;
}

.font-bold {
  font: bold;
}

.self-center {
  align-self: center;
}

.text-slate-500 {
  color: rgb(100 116 139) /* #64748b */;
}

.text-green-500 {
  color: rgb(34 197 94) /* #22c55e */;
}

.text-red-500 {
  color: rgb(239 68 68) /* #ef4444 */;
}
</style>
