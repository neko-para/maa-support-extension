import { type ShallowRef, onBeforeUnmount, onMounted, onUnmounted, ref } from 'vue'

import * as controlSt from '@/crop/states/control'
import * as imageSt from '@/crop/states/image'
import * as ocrSt from '@/crop/states/ocr'
import * as pickSt from '@/crop/states/pick'
import * as settingsSt from '@/crop/states/settings'
import { Box, Pos, Size } from '@/crop/utils/2d'

export const size = ref<Size>(Size.from(0, 0))

export function draw(ctx: CanvasRenderingContext2D) {
  ctx.reset()

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

    if (pickSt.picking.value) {
      const pos = controlSt.current.value.round()
      const clr = ctx.getImageData(pos.x, pos.y, 1, 1).data
      pickSt.color.value = [clr[0], clr[1], clr[2]]
    }

    if (ocrSt.draw.value && ocrSt.resultObject.value) {
      ctx.save()

      const info = ocrSt.resultObject.value
      const color = settingsSt.colorWithDefault(settingsSt.ocrStroke.value, 'green')

      ctx.fillStyle = color
      ctx.strokeStyle = color

      if (info.detail) {
        ctx.font = settingsSt.fontWithDefault(settingsSt.ocrFont.value, '24pt consolas')

        let entries = info.detail[ocrSt.drawType.value]
        if (!Array.isArray(entries)) {
          entries = [entries]
        }
        for (const entry of entries) {
          const box = controlSt.viewport.value.toView(
            Box.from(Pos.from(entry.box[0], entry.box[1]), Size.from(entry.box[2], entry.box[3]))
          )

          ctx.rect(...box.flat())
          ctx.stroke()

          ctx.fillText(entry.text, ...box.rb.add(Size.from(5, 0)).flat())
        }
      }

      ctx.restore()
    }
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
  if (1 / controlSt.viewport.value.scale >= (settingsSt.helperAxesThreshold.value ?? 10)) {
    const pos = controlSt.viewport.value.fromView(controlSt.current.value).round()
    const radius = Math.max(0, settingsSt.helperAxesRadius.value ?? 20)
    if (settingsSt.helperAxesOverflow.value) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dy = -radius; dy <= radius; dy += 1) {
          const dpos = controlSt.viewport.value.toView(pos.add(Size.from(dx, dy)))
          ctx.moveTo(dpos.x, 0)
          ctx.lineTo(dpos.x, size.value.h)
          ctx.moveTo(0, dpos.y)
          ctx.lineTo(size.value.w, dpos.y)
        }
      }
    } else {
      const scaledPos = controlSt.viewport.value.toView(pos)
      const scaledRadius = radius * (1 / controlSt.viewport.value.scale)
      const gradient = ctx.createRadialGradient(scaledPos.x, scaledPos.y, 0, scaledPos.x, scaledPos.y, scaledRadius)
      gradient.addColorStop(0.7, 'white')
      gradient.addColorStop(1, 'transparent')
      ctx.strokeStyle = gradient

      for (let dlt = 0; dlt <= radius; dlt += 1) {
        const len = Math.sqrt(radius * radius - dlt * dlt)

        ctx.moveTo(...controlSt.viewport.value.toView(pos.add(Size.from(-dlt, -len))).flat())
        ctx.lineTo(...controlSt.viewport.value.toView(pos.add(Size.from(-dlt, len))).flat())
        ctx.moveTo(...controlSt.viewport.value.toView(pos.add(Size.from(dlt, -len))).flat())
        ctx.lineTo(...controlSt.viewport.value.toView(pos.add(Size.from(dlt, len))).flat())
        ctx.moveTo(...controlSt.viewport.value.toView(pos.add(Size.from(-len, -dlt))).flat())
        ctx.lineTo(...controlSt.viewport.value.toView(pos.add(Size.from(len, -dlt))).flat())
        ctx.moveTo(...controlSt.viewport.value.toView(pos.add(Size.from(-len, dlt))).flat())
        ctx.lineTo(...controlSt.viewport.value.toView(pos.add(Size.from(len, dlt))).flat())
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
