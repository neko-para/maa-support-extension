<script setup lang="ts">
import { NButton } from 'naive-ui'

import ActButton from '@/components/ActButton.vue'
import GroupBox from '@/components/GroupBox.vue'
import RecoButton from '@/components/RecoButton.vue'
import StateLabel from '@/components/StateLabel.vue'
import { send } from '@/ipc'

import { taskList } from './task'

function requestStop() {
  send({
    cmd: 'launch.stop'
  })
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex gap-2">
      <n-button type="primary" @click="requestStop"> stop </n-button>
    </div>
    <div class="flex flex-wrap gap-2">
      <group-box v-for="(task, idx) in taskList.info" :key="idx" :title="task.info.entry">
        <div class="flex p-2 gap-2 flex-wrap">
          <group-box v-for="(nl, nidx) in task.nexts" :key="nidx" :title="nl.info.name">
            <div class="flex flex-col gap-2 h-full">
              <template v-for="nlc in nl.info.list.length" :key="nlc">
                <reco-button
                  v-if="nl.recos[nlc - 1]"
                  :id="nl.recos[nlc - 1].info.reco_id"
                  :status="nl.recos[nlc - 1].state"
                >
                  {{ nl.recos[nlc - 1].info.name }} - {{ nl.recos[nlc - 1].info.reco_id }}
                </reco-button>
                <state-label v-else :status="null">
                  {{ nl.info.list[nlc - 1] }}
                </state-label>
              </template>
              <span class="flex-1"></span>
              <act-button v-if="nl.act" :status="nl.act.state">
                {{ nl.act.info.name }} - {{ nl.act.info.node_id }}
              </act-button>
            </div>
          </group-box>
        </div>
      </group-box>
    </div>
  </div>
</template>
