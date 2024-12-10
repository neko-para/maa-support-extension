<script setup lang="ts">
import * as interfaceSt from '@/states/interface'

import CTaskOption from './CTaskOption.vue'

const props = defineProps<{
  taskIndex: number
}>()

const proto = interfaceSt.currentObj.value.task?.find(
  x => x.name === interfaceSt.currentConfigObj.value.task?.[props.taskIndex].name
)
</script>

<template>
  <div v-if="proto && proto.option?.length" class="col-flex" style="padding: 0.25rem 0 0.25rem 0">
    <c-task-option
      v-for="(opt, idx) in proto.option ?? []"
      :key="idx"
      :task-index="taskIndex"
      :option="opt"
    ></c-task-option>
  </div>
</template>
