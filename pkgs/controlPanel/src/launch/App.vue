<script setup lang="ts">
import { VscButton, VscScrollable } from '@/components/VscEl'
import { ipc } from '@/launch/main'
import * as recoSt from '@/launch/states/reco'
import * as taskSt from '@/launch/states/task'

function requestReco(id: number) {
  ipc.postMessage({
    cmd: 'queryReco',
    reco: id
  })
}
</script>

<template>
  <div id="root">
    <div class="flex gap-1 items-center">
      <vsc-button @click="taskSt.stop()" :disabled="taskSt.stopped.value"> stop </vsc-button>
    </div>
    <div class="flex gap-1 grow-0 min-h-0">
      <div class="flex-1 flex flex-col gap-1 min-w-0">
        <vsc-scrollable>
          <div class="flex flex-col gap-1 min-w-0">
            <div class="flex gap-1 items-center flex-wrap">
              <div
                class="mse-bg-vscode-sideBar-background flex flex-col gap-1 p-1 pt-0 rounded-md min-w-0"
                v-for="(task, idx) in taskSt.taskList.value.info"
                :key="idx"
                :title="task.info.entry"
              >
                <vscode-label class="self-center">
                  {{ task.info.entry }}
                </vscode-label>
                <div class="flex gap-1 items-center flex-wrap" style="align-items: flex-start">
                  <div
                    class="mse-bg-vscode-sideBar-background flex flex-col gap-1 p-1 pt-0 min-w-0"
                    v-for="(nl, nidx) in task.nexts"
                    :key="nidx"
                    :title="nl.info.name"
                  >
                    <vscode-label>
                      {{ nl.info.name }}
                    </vscode-label>
                    <div class="flex flex-col gap-1 min-w-0 flex-wrap">
                      <template v-for="nlc in nl.info.list.length" :key="nlc">
                        <vsc-button
                          v-if="nl.recos[nlc - 1]"
                          @click="requestReco(nl.recos[nlc - 1].info.reco_id)"
                          :loading="nl.recos[nlc - 1].state === 'running'"
                          :icon="nl.recos[nlc - 1].state === 'failed' ? 'close' : 'check'"
                        >
                          {{ nl.recos[nlc - 1].info.name }}
                        </vsc-button>
                        <vsc-button v-else disabled icon="indent">
                          {{ nl.info.list[nlc - 1] }}
                        </vsc-button>
                      </template>
                      <vsc-button
                        v-if="nl.act"
                        disabled
                        secondary
                        :loading="nl.act.state === 'running'"
                        :icon="nl.act.state === 'failed' ? 'close' : 'check'"
                      >
                        {{ nl.act.info.name }}
                      </vsc-button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </vsc-scrollable>
      </div>
      <div class="flex-1 flex flex-col gap-1 min-w-0">
        <vsc-scrollable v-if="recoSt.showRecoInfo.value && recoSt.recoInfo.value">
          <div class="mse-grid-form mse-bg-vscode-sideBar-background p-1 rounded-md">
            <vscode-label> Hit </vscode-label>
            <span> {{ recoSt.recoInfo.value.info.hit }} </span>
            <vscode-label> Box </vscode-label>
            <span> {{ recoSt.recoInfo.value.info.box }} </span>
            <vscode-label> Detail </vscode-label>
            <pre>{{ JSON.stringify(JSON.parse(recoSt.recoInfo.value.info.detail), null, 2) }}</pre>
            <vscode-label> Raw </vscode-label>
            <img :src="recoSt.recoInfo.value.raw" />
            <vscode-label> Draws </vscode-label>
            <div class="flex flex-col gap-1 min-w-0">
              <img v-for="(img, idx) in recoSt.recoInfo.value.draws" :key="idx" :src="img" />
            </div>
          </div>
        </vsc-scrollable>
      </div>
    </div>
  </div>
</template>
