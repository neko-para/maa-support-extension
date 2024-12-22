<script lang="ts" setup>
import { VscButton } from '@/components/VscEl'
import * as pickSt from '@/crop/states/pick'
</script>

<template>
  <div class="flex gap-1 items-center">
    <vsc-button @click="pickSt.start()"> pick </vsc-button>
    <template v-if="pickSt.color.value">
      <span class="select-none flex gap-1">
        picked color:
        <span class="select-all">{{ pickSt.color.value.join(', ') }}</span>
        <span class="select-all"
          >#{{ pickSt.color.value.map(x => x.toString(16).toUpperCase()).join('') }}</span
        >
      </span>
      <div class="w-6 h-6" :style="`background-color: rgb(${pickSt.color.value.join(',')});`"></div>
    </template>
  </div>
</template>
