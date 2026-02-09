import { type ShallowRef, onBeforeUnmount, onUnmounted, ref, watch } from 'vue'

import { hostState } from '../state'
import { Box, Pos, Size } from '../utils/2d'
import * as controlSt from './control'
import * as imageSt from './image'
import * as pickSt from './pick'
import * as matchSt from './quickMatch'
import * as recoSt from './reco'
import * as settingsSt from './settings'

export const size = ref<Size>(Size.from(0, 0))
let dashOffset = 0

export function draw(ctx: CanvasRenderingContext2D) {
  ctx.reset()

  ctx.fillStyle = settingsSt.backgroundFill.eff
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

    for (const [st, stroke, font] of [
      [matchSt, settingsSt.ocrStroke.eff, settingsSt.ocrFont.eff],
      [recoSt, settingsSt.recoStroke.eff, settingsSt.recoFont.eff]
    ] as const) {
      if (st.draw.value && st.resultObject.value) {
        ctx.save()

        const info = st.resultObject.value

        ctx.fillStyle = stroke
        ctx.strokeStyle = stroke

        if (info.detail) {
          ctx.font = font

          let detailEntries: {
            name: string
            entry: maa.RecoDetailWithoutDraws['detail']
          }[] = [
            {
              name: info.name,
              entry: info.detail
            }
          ]
          while (detailEntries.length > 0) {
            const fullEntry = detailEntries.shift()!
            if (Array.isArray(fullEntry.entry)) {
              detailEntries.push(
                ...fullEntry.entry.map(x => ({
                  name: x.name,
                  entry: x.detail
                }))
              )
              continue
            }

            let entries = fullEntry.entry[st.drawType.value] ?? []
            if (!Array.isArray(entries)) {
              entries = [entries]
            }
            for (const entry of entries) {
              const entry_box = entry.box
              const box = controlSt.viewport.value.toView(
                Box.from(
                  Pos.from(entry_box[0], entry_box[1]),
                  Size.from(entry_box[2], entry_box[3])
                )
              )

              ctx.rect(...box.flat())
              ctx.stroke()

              if (!fullEntry.name.startsWith('@mse/')) {
                ctx.fillText(fullEntry.name, ...box.rt.add(Size.from(5, 0)).flat())
              }
              ctx.fillText(entry.text ?? '', ...box.rb.add(Size.from(5, 0)).flat())
            }
          }
        }

        ctx.restore()
      }
    }
  }

  ctx.save()
  ctx.globalAlpha = settingsSt.selectOpacity.eff
  if (settingsSt.selectOutlineOnly.eff) {
    ctx.strokeStyle = settingsSt.selectFill.eff
    ctx.lineWidth = settingsSt.selectOutlineThickness.eff
    ctx.setLineDash([4, 4])

    dashOffset = (dashOffset + 0.2) % 8
    ctx.lineDashOffset = -dashOffset

    const box = controlSt.cropBoxInView.value
    const offset = settingsSt.selectOutlineThickness.eff % 2 === 1 ? 0.5 : 0
    ctx.strokeRect(
      Math.floor(box.origin.x) + offset,
      Math.floor(box.origin.y) + offset,
      Math.round(box.size.w),
      Math.round(box.size.h)
    )
  } else {
    ctx.fillStyle = settingsSt.selectFill.eff
    ctx.fillRect(...controlSt.cropBoxInView.value.flat())
  }
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = settingsSt.helperAxesOpacity.eff
  const helperAxesStroke = settingsSt.helperAxesStroke.eff
  ctx.strokeStyle = helperAxesStroke
  ctx.beginPath()
  if (1 / controlSt.viewport.value.scale >= settingsSt.helperAxesThreshold.eff) {
    const pos = controlSt.viewport.value.fromView(controlSt.current.value).round()
    const radius = Math.max(0, settingsSt.helperAxesRadius.eff)
    if (settingsSt.helperAxesOverflow.eff) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const dposX = controlSt.viewport.value.toView(pos.add(Size.from(dx, 0))).x
        ctx.moveTo(dposX, 0)
        ctx.lineTo(dposX, size.value.h)
      }
      for (let dy = -radius; dy <= radius; dy += 1) {
        const dposY = controlSt.viewport.value.toView(pos.add(Size.from(0, dy))).y
        ctx.moveTo(0, dposY)
        ctx.lineTo(size.value.w, dposY)
      }
    } else {
      const scaledPos = controlSt.viewport.value.toView(pos)
      const scaledRadius = radius * (1 / controlSt.viewport.value.scale)
      const gradient = ctx.createRadialGradient(
        scaledPos.x,
        scaledPos.y,
        0,
        scaledPos.x,
        scaledPos.y,
        scaledRadius
      )
      gradient.addColorStop(0.7, helperAxesStroke)
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

  ctx.strokeStyle = settingsSt.pointerAxesStroke.eff
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

  watch(
    () => canvasEl.value,
    () => {
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
    },
    {
      once: true
    }
  )

  onBeforeUnmount(() => {
    resizeObs.unobserve(sizeEl.value!)
  })

  onUnmounted(() => {
    if (drawTimer) {
      clearInterval(drawTimer)
    }
  })
}
