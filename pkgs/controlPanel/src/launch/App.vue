<script setup lang="ts">
import { VscButton } from '@/components/VscEl'
import * as taskSt from '@/launch/states/task'

import { taskList } from './states/task'
</script>

<template>
  <div id="root">
    <div v-if="!taskSt.stopped.value" class="row-flex">
      <vsc-button v-if="!taskSt.stopped.value" @click="taskSt.stop()"> stop </vsc-button>
    </div>
    <div class="row-flex flex-wrap">
      <div
        class="group-box flex-col"
        v-for="(task, idx) in taskList.info"
        :key="idx"
        :title="task.info.entry"
      >
        <vscode-label class="group-box-title">
          {{ task.info.entry }}
        </vscode-label>
        <div class="task-box">
          <template v-for="(nl, nidx) in task.nexts" :key="nidx" :title="nl.info.name">
            <vscode-label>
              {{ nl.info.name }}
            </vscode-label>
            <div class="col-flex flex-wrap">
              <template v-for="nlc in nl.info.list.length" :key="nlc">
                <vsc-button v-if="nl.recos[nlc - 1]">
                  {{ nl.recos[nlc - 1].info.name }}
                </vsc-button>
                <vsc-button v-else disabled>
                  {{ nl.info.list[nlc - 1] }}
                </vsc-button>
              </template>
            </div>
            <span v-if="nl.act"> {{ nl.act.info.name }} </span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
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
}
</style>
