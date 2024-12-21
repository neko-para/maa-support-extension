import { type ShallowRef, onBeforeUnmount, onMounted, onUnmounted, ref } from 'vue'

import * as controlSt from '@/crop/states/control'
import * as imageSt from '@/crop/states/image'
import { Box, Pos, Size } from '@/crop/utils/2d'

export const size = ref<Size>(Size.from(0, 0))

export function draw(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, ...size.value.flat())

  if (imageSt.element.value) {
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(
      imageSt.element.value,
      0,
      0,
      ...imageSt.size.value.flat(),
      ...controlSt.viewport.value.toView(Box.from(new Pos(), imageSt.size.value)).flat()
    )
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.fillRect(...controlSt.cropBoxInView.value.flat())

  ctx.strokeStyle = 'rgba(255, 127, 127, 1)'
  ctx.beginPath()
  ctx.moveTo(controlSt.current.value.x, 0)
  ctx.lineTo(controlSt.current.value.x, size.value.h)
  ctx.moveTo(0, controlSt.current.value.y)
  ctx.lineTo(size.value.w, controlSt.current.value.y)
  ctx.stroke()
}

export function setup(
  sizeEl: Readonly<ShallowRef<HTMLDivElement | null>>,
  canvasEl: Readonly<ShallowRef<HTMLCanvasElement | null>>
) {
  let resizeObs: ResizeObserver
  let drawTimer: ReturnType<typeof setInterval>

  onMounted(() => {
    const ctx = canvasEl.value!.getContext('2d')!

    const resize = () => {
      const rec = sizeEl.value!.getBoundingClientRect()
      size.value.set(rec.width, rec.height)
      canvasEl.value!.width = rec.width
      canvasEl.value!.height = rec.height
      draw(ctx)
    }
    resizeObs = new ResizeObserver(resize)
    resizeObs.observe(sizeEl.value!)
    resize()
    drawTimer = setInterval(() => draw(ctx), 20)
  })

  onBeforeUnmount(() => {
    resizeObs.unobserve(sizeEl.value!)
  })

  onUnmounted(() => {
    if (drawTimer) {
      clearInterval(drawTimer)
    }
  })
}
