import { type ShallowRef, onBeforeUnmount, onMounted, onUnmounted, ref } from 'vue'

import * as controlSt from '@/crop/states/control'
import * as imageSt from '@/crop/states/image'
import * as settingsSt from '@/crop/states/settings'
import { Box, Pos, Size } from '@/crop/utils/2d'

export const size = ref<Size>(Size.from(0, 0))

export function draw(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = settingsSt.colorWithDefault(settingsSt.backgroundFill.value, 'white')
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

  ctx.save()
  ctx.globalAlpha = settingsSt.toAlpha(settingsSt.selectOpacity.value, 0.3)
  ctx.fillStyle = settingsSt.colorWithDefault(settingsSt.selectFill.value, 'wheat')
  ctx.fillRect(...controlSt.cropBoxInView.value.flat())
  ctx.restore()

  ctx.save()
  ctx.globalCompositeOperation = 'difference'
  ctx.strokeStyle = 'white'
  ctx.beginPath()
  if (1 / controlSt.viewport.value.scale >= 10) {
    const pos = controlSt.viewport.value.fromView(controlSt.current.value).round()
    for (let dx = -10; dx <= 10; dx += 1) {
      for (let dy = -10; dy <= 10; dy += 1) {
        const dpos = controlSt.viewport.value.toView(pos.add(Size.from(dx, dy)))
        ctx.moveTo(dpos.x, 0)
        ctx.lineTo(dpos.x, size.value.h)
        ctx.moveTo(0, dpos.y)
        ctx.lineTo(size.value.w, dpos.y)
      }
    }
  }
  ctx.stroke()
  ctx.restore()

  ctx.strokeStyle = settingsSt.colorWithDefault(
    settingsSt.pointerAxesStroke.value,
    'rgba(255, 127, 127, 1)'
  )
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
