<script lang="ts" setup>
import { VscButton } from '@/components/VscEl'
import * as controlSt from '@/crop/states/control'
import * as imageSt from '@/crop/states/image'
</script>

<template>
  <div class="flex gap-2 flex-col">
    <div class="flex gap-2">
      <span class="select-none"> size: {{ imageSt.size.value.flat().join(', ') }} </span>
      <span class="select-none">
        position: {{ controlSt.currentInView.value.flat().join(', ') }}
      </span>
      <span class="select-none"> current: {{ controlSt.current.value.flat().join(', ') }} </span>
    </div>

    <div class="flex items-center gap-2">
      <vsc-button
        @click="imageSt.screencap()"
        :loading="imageSt.loading.value"
        :disabled="imageSt.loading.value"
      >
        screencap
      </vsc-button>
      <vsc-button
        @click="imageSt.upload()"
        :loading="imageSt.loading.value"
        :disabled="imageSt.loading.value"
      >
        upload
      </vsc-button>
      <vsc-button @click="imageSt.download()"> download </vsc-button>
      <vsc-button @click="controlSt.viewport.value.reset()"> reset </vsc-button>
      <vsc-button @click="controlSt.cropCeil()"> ceil </vsc-button>
      <vsc-button @click="controlSt.cropBound()"> bound </vsc-button>
      <vsc-button @click="controlSt.copyRoi()" icon="copy">
        roi {{ controlSt.cropBox.value.ceiled().flat() }}
      </vsc-button>
      <vsc-button @click="controlSt.copyRoiExpand()" icon="copy">
        roi ex {{ controlSt.cropBoxExpand.value.ceiled().flat() }}
      </vsc-button>
      <!-- <n-button @click="copyRoi"> roi </n-button> -->
      <!-- <n-button @click="pickColor = !pickColor"> pick color </n-button>  -->
      <span class="select-none"> Ctrl裁剪，点击移动；ceil对齐像素，bound移除出界范围 </span>
    </div>
  </div>
</template>
