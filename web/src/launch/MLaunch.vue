<script setup lang="ts">
import { NButton } from 'naive-ui'

import { send } from '../ipc'
import { taskList } from './task'

function requestReco(id?: number) {
  if (typeof id !== 'number') {
    return
  }
  send({
    cmd: 'launch.reco',
    reco: id
  })
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <div v-for="(node, idx) in taskList.node" :key="idx" class="flex flex-col">
      <div class="flex flex-col gap-2 border p-2">
        <span class="font-bold self-center"> {{ node.pre_hit_task }} </span>
        <template v-for="(reco, ridx) in node.reco_list" :key="ridx">
          <n-button @click="requestReco(reco.reco_id)">
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
