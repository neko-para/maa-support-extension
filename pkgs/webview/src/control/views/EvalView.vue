<script setup lang="ts">
import { NButton, NCard, NFlex, NInput, NSwitch } from 'naive-ui'
import { computed, ref } from 'vue'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import { hostState } from '../state'

const task = ref('')
const expr = ref('')

const isTaskValid = computed(() => {
  return /^[ \n\ta-zA-Z0-9_@-]+$/.test(task.value)
})

const isExprValid = computed(() => {
  return /^[ \n\ta-zA-Z0-9_@#+*^()-]+$/.test(expr.value)
})

function evalTask() {
  ipc.send({
    command: 'maa.evalTask',
    task: task.value
  })
}

function evalExpr() {
  ipc.send({
    command: 'maa.evalExpr',
    expr: expr.value,
    host: task.value
  })
}

function updateExpandList(expandList: boolean) {
  ipc.send({
    command: 'maa.updateEvalConfig',
    config: {
      ...(hostState.value.evalTaskConfig ?? {}),

      expandList
    }
  })
}

function updateStripList(stripList: boolean) {
  ipc.send({
    command: 'maa.updateEvalConfig',
    config: {
      ...(hostState.value.evalTaskConfig ?? {}),

      stripList
    }
  })
}
</script>

<template>
  <n-card :title="t('maa.control.eval-tool')" size="small">
    <n-flex vertical>
      <n-input v-model:value="task" placeholder="input task" size="small"></n-input>
      <n-input v-model:value="expr" placeholder="input expr" size="small"></n-input>
      <n-flex>
        <n-switch
          :value="hostState.evalTaskConfig?.expandList"
          @update:value="updateExpandList"
        ></n-switch>
        <span>
          {{
            hostState.evalTaskConfig?.expandList
              ? t('maa.control.expand-list')
              : t('maa.control.not-expand-list')
          }}
        </span>
      </n-flex>
      <n-flex>
        <n-switch
          :value="hostState.evalTaskConfig?.stripList ?? true"
          @update:value="updateStripList"
        ></n-switch>
        <span>
          {{
            (hostState.evalTaskConfig?.stripList ?? true)
              ? `${t('maa.control.strip-list')} - next / on_error_next / exceeded_next`
              : `${t('maa.control.not-strip-list')} - sub / reduce_other_times`
          }}
        </span>
      </n-flex>
      <n-flex>
        <n-button :disabled="!isTaskValid" @click="evalTask" size="small">
          {{ t('maa.control.eval-task') }}
        </n-button>
        <n-button :disabled="!isTaskValid || !isExprValid" @click="evalExpr" size="small">
          {{ t('maa.control.eval-list') }}
        </n-button>
      </n-flex>
    </n-flex>
  </n-card>
</template>
