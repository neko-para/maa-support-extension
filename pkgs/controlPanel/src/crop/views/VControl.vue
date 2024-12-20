<script lang="ts" setup>
import { VscButton } from '@/components/VscEl'
import * as imageSt from '@/crop/states/image'
</script>

<template>
  <div class="flex gap-2 flex-col">
    <div class="flex gap-2">
      <span> size: {{ imageSt.size.value.flat() }} </span>
    </div>

    <div class="flex items-center gap-2">
      <vsc-button @click="imageSt.screencap()" :loading="imageSt.loading.value > 0">
        screencap
      </vsc-button>
      <!--    <n-button @click="() => viewport.reset()"> reset </n-button>
        <n-button @click="cropCeil"> ceil </n-button>
        <n-button @click="cropBound"> bound </n-button>
        <n-button @click="copyRoi"> roi </n-button> -->
      <vsc-button @click="imageSt.upload()" :loading="imageSt.loading.value > 0">
        upload
      </vsc-button>
      <!-- <vsc-button @click="download"> download </vsc-button> -->
      <!-- <n-button @click="pickColor = !pickColor"> pick color </n-button>
        <span> 左键移动裁剪区域，中键移动视图，右键裁剪；ceil对齐像素，bound移除出界范围 </span> -->
    </div>
  </div>
</template>
