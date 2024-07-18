<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import hljsJson from 'highlight.js/lib/languages/json'
import { NButton, NCard, NCode, NConfigProvider, NModal } from 'naive-ui'

import { send } from './ipc'
import { recoInfo, showRecoInfo } from './reco'
import { taskList } from './task'

hljs.registerLanguage('json', hljsJson)

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
  <n-config-provider :hljs="hljs">
    <n-modal v-model:show="showRecoInfo">
      <n-card
        style="max-width: 90vw; margin-top: 5vh; max-height: 90vh; overflow-y: auto"
        role="dialog"
        v-if="recoInfo"
      >
        <div class="maa-form">
          <span> Hit </span>
          <span> {{ recoInfo.info.hit }} </span>
          <span> Box </span>
          <span> {{ recoInfo.info.hit_box }} </span>
          <span> Detail </span>
          <n-code :code="recoInfo.info.detail_json" language="json"></n-code>
          <span> Raw </span>
          <img :src="recoInfo.raw" />
          <span> Draws </span>
          <div class="flex flex-col gap-2">
            <img v-for="(img, idx) in recoInfo.draws" :key="idx" :src="img" />
          </div>
        </div>
      </n-card>
    </n-modal>

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
  </n-config-provider>
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

.maa-form {
  display: grid;
  grid-template-columns: max-content auto;
  align-items: center;
  gap: 0.5rem;
}
</style>
