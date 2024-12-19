<script setup lang="ts">
import { NButton } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, shallowRef } from 'vue'

import { send } from '@/ipc'
import { ipc } from '@/main'
import { Box, DragHandler, Pos, Size, Viewport } from '@/utils/2d'

import { setFulfillImage } from './crop'

const canvasW = ref(0)
const canvasH = ref(0)

const image = ref<string | null>(null)
const imageEl = shallowRef<HTMLImageElement | null>(null)
const loading = ref(false)
const imageSize = ref<Size>(new Size())

async function setImage(url: string) {
  console.log('setImage called')
  // if (image.value) {
  //   URL.revokeObjectURL(image.value)
  // }
  image.value = url
  if (!imageEl.value) {
    imageEl.value = new Image()
  }
  imageEl.value.src = image.value
  await new Promise(resolve => {
    imageEl.value!.onload = resolve
  })
  imageSize.value.set(imageEl.value.width, imageEl.value.height)

  loading.value = false

  return true
}

async function screencap() {
  loading.value = true

  send({
    cmd: 'crop.screencap'
  })
}

/*
async function uploadImage() {
  loading.value = true
  const file = await triggerUpload({
    mimeTypes: ['image/png']
  })
  if (!file) {
    loading.value = false
    return
  }
  const url = URL.createObjectURL(file)
  if (!(await setImage(url))) {
    URL.revokeObjectURL(url)
  }
  loading.value = false
}
*/

onUnmounted(() => {
  // if (image.value) {
  //   URL.revokeObjectURL(image.value)
  // }
  setFulfillImage(() => {})
})

const canvasSizeEl = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

type CornerType = 'lt' | 'lb' | 'rt' | 'rb'
const corners: CornerType[] = ['lt', 'lb', 'rt', 'rb']
type EdgeType = 'l' | 't' | 'r' | 'b'
const edges: EdgeType[] = ['l', 't', 'r', 'b']
const resizeCursor: Record<CornerType | EdgeType | 'def', string> = {
  lt: 'nwse-resize',
  rb: 'nwse-resize',
  lb: 'nesw-resize',
  rt: 'nesw-resize',
  l: 'ew-resize',
  r: 'ew-resize',
  t: 'ns-resize',
  b: 'ns-resize',
  def: 'default'
}
const edgeSide: Record<EdgeType, 'x' | 'y'> = {
  l: 'x',
  r: 'x',
  t: 'y',
  b: 'y'
}

const cursor = ref<string>('default')
const viewport = ref<Viewport>(new Viewport())
const viewMoveDrag = ref<DragHandler>(new DragHandler())
const cropMoveDrag = ref<DragHandler>(new DragHandler())
const cornerMoveDrag = ref<DragHandler>(new DragHandler())
const cornerMoveTarget = ref<CornerType | EdgeType>('lt')
const cropDrag = ref<DragHandler>(new DragHandler())
const cropBox = ref<Box>(new Box())
const cropBoxExpand = computed<Box>(() => {
  return cropBox.value
    .copy()
    .setOrigin(cropBox.value.origin.sub(Size.from(50, 50)))
    .setSize(cropBox.value.size.add(Size.from(100, 100)))
    .intersect(Box.from(new Pos(), imageSize.value))
})
const current = ref<Pos>(new Pos())
const pickColor = ref(false)
const pickedColor = ref<[r: number, g: number, b: number] | null>(null)

const cropBoxView = computed<Box>({
  get() {
    return viewport.value.toView(cropBox.value)
  },
  set(b: Box) {
    cropBox.value = viewport.value.fromView(b)
  }
})

function onScroll(ev: WheelEvent) {
  viewport.value.zoom(ev.deltaY > 0, Pos.fromEvent(ev))
}

function detectCorner(box: Box, pos: Pos, thres = 4): CornerType | null {
  for (const corner of corners) {
    if (pos.dis(box[corner]) <= thres) {
      return corner
    }
  }
  return null
}

function detectEdge(box: Box, pos: Pos, thres = 4): EdgeType | null {
  for (const edge of edges) {
    if (Math.abs(pos[edgeSide[edge]] - box[edge]) < thres) {
      return edge
    }
  }
  return null
}

function onMouseDown(ev: PointerEvent) {
  const mp = Pos.fromEvent(ev)
  current.value = mp
  if (ev.button === 0) {
    const corner = detectCorner(cropBoxView.value, mp)
    if (corner) {
      cornerMoveTarget.value = corner
      cornerMoveDrag.value.down(mp, cropBoxView.value[corner])
      canvasEl.value!.setPointerCapture(ev.pointerId)
    } else {
      const edge = detectEdge(cropBoxView.value, mp)
      if (edge) {
        const fakePos = new Pos()
        fakePos[edgeSide[edge]] = cropBoxView.value[edge]
        cornerMoveTarget.value = edge
        cornerMoveDrag.value.down(mp, fakePos)
        canvasEl.value!.setPointerCapture(ev.pointerId)
      } else {
        cropMoveDrag.value.down(mp, cropBoxView.value.origin)
        canvasEl.value!.setPointerCapture(ev.pointerId)
        cursor.value = 'grab'
      }
    }
  } else if (ev.button === 1) {
    viewMoveDrag.value.down(mp, viewport.value.offset)
    canvasEl.value!.setPointerCapture(ev.pointerId)
    cursor.value = 'grab'
  } else if (ev.button === 2) {
    cropDrag.value.down(mp, mp)
    canvasEl.value!.setPointerCapture(ev.pointerId)
    cursor.value = 'crosshair'
  }
}

function onMouseMove(ev: PointerEvent) {
  const mp = Pos.fromEvent(ev)
  current.value = mp

  if (cornerMoveDrag.value.state) {
    cornerMoveDrag.value.move(mp)
    const dlt = cornerMoveDrag.value.current.sub(cropBoxView.value.origin)
    const v = cropBoxView.value.copy()
    for (const ch of cornerMoveTarget.value) {
      const cht = ch as EdgeType
      switch (cht) {
        case 'l': {
          v.origin.x = cornerMoveDrag.value.current.x
          v.size.w = v.size.w - dlt.w
          break
        }
        case 't': {
          v.origin.y = cornerMoveDrag.value.current.y
          v.size.h = v.size.h - dlt.h
          break
        }
        case 'r': {
          v.size.w = dlt.w
          break
        }
        case 'b': {
          v.size.h = dlt.h
          break
        }
      }
    }
    cropBoxView.value = v
  } else if (cropMoveDrag.value.state) {
    cropMoveDrag.value.move(mp)
    cropBoxView.value = cropBoxView.value.copy().setOrigin(cropMoveDrag.value.current)
  } else if (viewMoveDrag.value.state) {
    viewMoveDrag.value.move(mp)
    viewport.value.offset = viewMoveDrag.value.current
  } else if (cropDrag.value.state) {
    cropDrag.value.move(mp)
    cropBoxView.value = cropDrag.value.box
  } else {
    const corner = detectCorner(cropBoxView.value, mp)
    const edge = detectEdge(cropBoxView.value, mp)
    cursor.value = resizeCursor[corner ?? edge ?? 'def']
  }
}

function onMouseUp(ev: PointerEvent) {
  pickColor.value = false

  if (cornerMoveDrag.value.state && ev.button === 0) {
    cornerMoveDrag.value.up()
    canvasEl.value!.releasePointerCapture(ev.pointerId)
    cursor.value = 'default'
  } else if (cropMoveDrag.value.state && ev.button === 0) {
    cropMoveDrag.value.up()
    canvasEl.value!.releasePointerCapture(ev.pointerId)
    cursor.value = 'default'
  } else if (viewMoveDrag.value.state && ev.button === 1) {
    viewMoveDrag.value.up()
    canvasEl.value!.releasePointerCapture(ev.pointerId)
    cursor.value = 'default'
  } else if (cropDrag.value.state && ev.button === 2) {
    cropDrag.value.up()
    canvasEl.value!.releasePointerCapture(ev.pointerId)
    cursor.value = 'default'
  }
}

function draw(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'wheat'
  ctx.fillRect(0, 0, canvasW.value, canvasH.value)
  if (imageEl.value) {
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(
      imageEl.value,
      0,
      0,
      ...imageSize.value.flat(),
      ...viewport.value.toView(Box.from(new Pos(), imageSize.value)).flat()
    )

    if (pickColor.value) {
      const pos = current.value.round()
      const clr = ctx.getImageData(pos.x, pos.y, 1, 1).data
      pickedColor.value = [clr[0], clr[1], clr[2]]
    }
  }
  ctx.fillStyle = ipc.context.value.selectFill ?? 'rgba(255, 255, 255, 0.3)'
  ctx.fillRect(...cropBoxView.value.flat())

  // ctx.save()
  // ctx.globalCompositeOperation = 'difference'
  // ctx.strokeStyle = 'white'
  // ctx.beginPath()
  // if (1 / viewport.value.scale >= 4) {
  //   const pos = viewport.value.fromView(current.value).round()
  //   for (let dx = -10; dx <= 10; dx += 1) {
  //     for (let dy = -10; dy <= 10; dy += 1) {
  //       const dpos = viewport.value.toView(pos.add(Size.from(dx, dy)))
  //       ctx.moveTo(dpos.x, 0)
  //       ctx.lineTo(dpos.x, canvasH.value)
  //       ctx.moveTo(0, dpos.y)
  //       ctx.lineTo(canvasW.value, dpos.y)
  //     }
  //   }
  // }
  // ctx.stroke()
  // ctx.restore()

  ctx.strokeStyle = 'rgba(255, 127, 127, 1)'
  ctx.beginPath()
  ctx.moveTo(current.value.x, 0)
  ctx.lineTo(current.value.x, canvasH.value)
  ctx.moveTo(0, current.value.y)
  ctx.lineTo(canvasW.value, current.value.y)
  ctx.stroke()
}

let drawTimer: NodeJS.Timeout = 0 as unknown as NodeJS.Timeout
let resizeObs: ResizeObserver

onMounted(() => {
  const ctx = canvasEl.value!.getContext('2d')!
  const resize = () => {
    const rec = canvasSizeEl.value!.getBoundingClientRect()
    canvasW.value = rec.width
    canvasH.value = rec.height
    canvasEl.value!.width = rec.width
    canvasEl.value!.height = rec.height
    draw(ctx)
  }
  resizeObs = new ResizeObserver(resize)
  resizeObs.observe(canvasSizeEl.value!)
  resize()
  drawTimer = setInterval(() => draw(ctx), 20)

  setFulfillImage(setImage)
})

onBeforeUnmount(() => {
  resizeObs.unobserve(canvasSizeEl.value!)
})

onUnmounted(() => {
  if (drawTimer) {
    clearInterval(drawTimer)
  }
})

function cropCeil() {
  cropBox.value.ceil()
}

function cropBound() {
  cropBox.value = cropBox.value.intersect(Box.from(new Pos(), imageSize.value))
}

async function getImage() {
  if (!image.value) {
    return null
  }
  cropCeil()
  cropBound()
  const cropPos = cropBox.value.flat()
  if (cropPos[2] === 0 || cropPos[3] === 0) {
    return null
  }
  const buffer = await (await fetch(image.value)).arrayBuffer()
  const jimp = await Jimp.read(Buffer.from(buffer))
  const croped = jimp.crop(...cropPos)
  const result = await croped.getBufferAsync('image/png')

  const resultBlob = new Blob([result.buffer])
  return resultBlob
}

function copyRoi() {
  navigator.clipboard.writeText(JSON.stringify(cropBox.value.flat()))
}

// const resizing = ref(false)

/*
async function resize() {
  if (!image.value) {
    return
  }
  resizing.value = true
  const buffer = await (await fetch(image.value)).arrayBuffer()
  const oldImg = await Jimp.read(Buffer.from(buffer))
  let targetW = 0
  let targetH = 0
  const expectSize = [1280, 720]
  if (oldImg.bitmap.width / oldImg.bitmap.height === 16 / 9) {
    targetW = expectSize[0]
    targetH = expectSize[1]
  } else if (oldImg.bitmap.width / oldImg.bitmap.height === 9 / 16) {
    targetW = expectSize[1]
    targetH = expectSize[0]
  } else {
    console.log('size not 16:9, quit')
    resizing.value = false
    return
  }
  const mat = new cv.Mat(oldImg.bitmap.height, oldImg.bitmap.width, cv.CV_8UC4)
  mat.data.set(oldImg.bitmap.data)
  const dst = new cv.Mat()
  cv.resize(mat, dst, new cv.Size(targetW, targetH), 0, 0, cv.INTER_AREA)
  mat.delete()
  const newImg = await Jimp.create(dst.cols, dst.rows)
  newImg.bitmap.data = Buffer.from(dst.data as Uint8Array)
  dst.delete()
  const result = await newImg.getBufferAsync('image/png')
  const resultBlob = new Blob([result.buffer])
  const url = URL.createObjectURL(resultBlob)
  if (!(await setImage(url))) {
    URL.revokeObjectURL(url)
  }
  resizing.value = false
}
*/

async function upload() {
  send({
    cmd: 'crop.upload'
  })
}

async function download() {
  const blob = await getImage()
  if (!blob) {
    return
  }

  send({
    cmd: 'crop.download',
    image: Buffer.from(await blob.arrayBuffer()).toString('base64'),
    roi: cropBox.value.flat(),
    expandRoi: cropBoxExpand.value.flat()
  })
}
</script>

<template>
  <div class="flex flex-col gap-2 flex-1">
    <div class="flex gap-2 flex-col">
      <div class="flex gap-2">
        <span> size: {{ imageSize.flat() }} </span>
        <span>
          state:
          {{ viewMoveDrag.state ? 'viewMoveDrag' : '' }}
          {{ cropMoveDrag.state ? 'cropMoveDrag' : '' }}
          {{ cornerMoveDrag.state ? 'cornerMoveDrag ' + cornerMoveTarget : '' }}
          {{ cropDrag.state ? 'cropDrag' : '' }}
        </span>
      </div>
      <span class="select-none">
        roi: <span class="select-all">{{ cropBox.flat() }}</span>
      </span>
      <span class="select-none">
        suggest roi: <span class="select-all">{{ cropBoxExpand.flat() }}</span>
      </span>
      <div class="flex items-center gap-2" v-if="pickedColor">
        <span class="select-none">
          picked color: <span class="select-all">{{ pickedColor.join(', ') }}</span>
        </span>
        <div
          style="width: 32px; height: 32px"
          :style="`background-color: rgb(${pickedColor.join(',')});`"
        ></div>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <n-button @click="screencap" :loading="loading"> screencap </n-button>
      <!-- <n-button @click="uploadImage" :loading="loading"> upload </n-button> -->
      <n-button @click="() => viewport.reset()"> reset </n-button>
      <n-button @click="cropCeil"> ceil </n-button>
      <n-button @click="cropBound"> bound </n-button>
      <n-button @click="copyRoi"> roi </n-button>
      <!-- <n-button @click="resize" :loading="resizing"> resize </n-button> -->
      <n-button @click="upload"> upload </n-button>
      <n-button @click="download"> download </n-button>
      <n-button @click="pickColor = !pickColor"> pick color </n-button>
      <span> 左键移动裁剪区域，中键移动视图，右键裁剪；ceil对齐像素，bound移除出界范围 </span>
    </div>
    <div ref="canvasSizeEl" class="relative flex-1">
      <canvas
        ref="canvasEl"
        class="absolute left-0 top-0"
        :style="{
          cursor: cursor
        }"
        @wheel="onScroll"
        @pointerdown="onMouseDown"
        @pointermove="onMouseMove"
        @pointerup="onMouseUp"
        @contextmenu.prevent=""
      ></canvas>
    </div>
  </div>
</template>
