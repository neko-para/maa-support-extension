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
    <div v-if="!taskSt.stopped.value" class="row-flex">
      <vsc-button v-if="!taskSt.stopped.value" @click="taskSt.stop()"> stop </vsc-button>
    </div>
    <div class="main-box">
      <div class="col-flex">
        <vsc-scrollable>
          <div class="col-flex">
            <div class="row-flex flex-wrap">
              <div
                class="group-box col-flex"
                v-for="(task, idx) in taskSt.taskList.value.info"
                :key="idx"
                :title="task.info.entry"
              >
                <vscode-label class="group-box-title">
                  {{ task.info.entry }}
                </vscode-label>
                <div class="row-flex flex-wrap" style="align-items: flex-start">
                  <div
                    class="group-box col-flex"
                    v-for="(nl, nidx) in task.nexts"
                    :key="nidx"
                    :title="nl.info.name"
                  >
                    <vscode-label>
                      {{ nl.info.name }}
                    </vscode-label>
                    <div class="col-flex flex-wrap">
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
      <div class="col-flex">
        <vsc-scrollable v-if="recoSt.showRecoInfo.value && recoSt.recoInfo.value">
          <div class="reco-box">
            <vscode-label> Hit </vscode-label>
            <span> {{ recoSt.recoInfo.value.info.hit }} </span>
            <vscode-label> Box </vscode-label>
            <span> {{ recoSt.recoInfo.value.info.box }} </span>
            <vscode-label> Detail </vscode-label>
            <pre>{{ JSON.stringify(JSON.parse(recoSt.recoInfo.value.info.detail), null, 2) }}</pre>
            <vscode-label> Raw </vscode-label>
            <img :src="recoSt.recoInfo.value.raw" />
            <vscode-label> Draws </vscode-label>
            <div class="col-flex">
              <img v-for="(img, idx) in recoSt.recoInfo.value.draws" :key="idx" :src="img" />
            </div>
          </div>
        </vsc-scrollable>
      </div>
    </div>
  </div>
</template>

<style>
.main-box {
  display: flex;
  gap: 0.25rem;
  flex-grow: 0;
  min-height: 0;
}

.main-box > div {
  flex: 1;
}

.group-box {
  border-radius: 0.25rem;
  background-color: var(--vscode-sideBar-background);
  padding: 0.25rem;
  padding-top: 0;
}

.group-box-title {
  align-self: center;
}

.height-full {
  height: 100%;
}

.task-box {
  display: grid;
  grid-auto-flow: column;
  grid-template-columns: auto;
  grid-template-rows: max-content max-content max-content;
  gap: 0.25rem;

  max-width: 50%;
}

.reco-box {
  border-radius: 0.25rem;
  background-color: var(--vscode-sideBar-background);
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem;
  padding: 0.25rem;
  align-items: center;
}
</style>
