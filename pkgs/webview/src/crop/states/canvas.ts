import {
  type ReactiveEffectRunner,
  type ShallowRef,
  effect,
  onMounted,
  onUnmounted,
  ref,
  shallowReactive,
  stop,
  watch
} from 'vue'

import { editorBackgroundColor } from '../../utils/theme'
import { Box, Pos, Size, Viewport } from '../utils/2d'
import * as autoMaskSt from './autoMask'
import * as colorPreviewSt from './colorPreview'
import * as controlSt from './control'
import * as greenMaskSt from './greenMask'
import * as imageSt from './image'
import * as maskApplySt from './maskApply'
import * as pickSt from './pick'
import * as settingsSt from './settings'
import * as subjectMaskSt from './subjectMask'
import * as subjectSelectSt from './subjectSelect'

export const size = ref<Size>(Size.from(0, 0))
let dashOffset = 0

/** 把整张图像居中完整放进画布；小图保持原始尺寸不放大 */
export function fitViewport() {
  const img = imageSt.size.value
  const view = size.value
  const vp = controlSt.viewport.value
  if (!img.w || !img.h || !view.w || !view.h) {
    vp.reset()
    return
  }
  const scale = Math.max(img.w / view.w, img.h / view.h, 1)
  vp.scale = scale
  vp.offset = Pos.from(
    Math.round((view.w - img.w / scale) / 2),
    Math.round((view.h - img.h / scale) / 2)
  )
}

/** 原始像素大小（1:1），左上角对齐 */
export function actualSizeViewport() {
  controlSt.viewport.value.reset()
}

// 图像尺寸变化（首次载入、换了设备或缩放）时自动适应画布；
// 同尺寸的新截图保持当前视图，反复截图对比时不会跳动。
// 外部送图可能早于画布布局完成，此时等画布有了尺寸再适应。
let fitPending = false
watch(
  () => `${imageSt.size.value.w}x${imageSt.size.value.h}`,
  () => {
    if (imageSt.size.value.w <= 0) {
      return
    }
    if (size.value.w > 0 && size.value.h > 0) {
      fitViewport()
    } else {
      fitPending = true
    }
  }
)
watch(
  () => size.value.w > 0 && size.value.h > 0,
  ready => {
    if (ready && fitPending) {
      fitPending = false
      fitViewport()
    }
  }
)

export type DrawStep = (ctx: CanvasRenderingContext2D, vp: Viewport) => void

export const drawSteps = shallowReactive<DrawStep[]>([])

export function addDrawStep(step: DrawStep): () => void {
  drawSteps.push(step)
  return () => {
    const idx = drawSteps.findIndex(func => func === step)
    if (idx !== -1) {
      drawSteps.splice(idx, 1)
    }
  }
}

export function useDrawStep(step: DrawStep) {
  let release: () => void
  onMounted(() => {
    release = addDrawStep(step)
  })
  onUnmounted(() => {
    release()
  })
}

export function draw(ctx: CanvasRenderingContext2D) {
  ctx.reset()

  ctx.fillStyle = editorBackgroundColor.value
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

    const maskCanvas = greenMaskSt.getMaskCanvas()
    if (maskCanvas) {
      ctx.save()
      ctx.globalAlpha = 0.5
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(
        maskCanvas,
        0,
        0,
        ...imageSt.size.value.flat(),
        ...controlSt.viewport.value.toView(Box.from(new Pos(), imageSt.size.value)).flat()
      )
      ctx.restore()
    }

    const regionOverlay = subjectSelectSt.regionCanvas.value
    if (regionOverlay && maskApplySt.lassoShown.value) {
      ctx.save()
      ctx.drawImage(
        regionOverlay,
        0,
        0,
        ...imageSt.size.value.flat(),
        ...controlSt.viewport.value.toView(Box.from(new Pos(), imageSt.size.value)).flat()
      )
      ctx.restore()
    }

    const autoPreview = autoMaskSt.previewCanvas.value
    if (autoMaskSt.enabled.value && autoPreview) {
      const [offsetX, offsetY] = autoMaskSt.previewOffset.value
      ctx.save()
      ctx.drawImage(
        autoPreview,
        0,
        0,
        autoPreview.width,
        autoPreview.height,
        ...controlSt.viewport.value
          .toView(
            Box.from(Pos.from(offsetX, offsetY), Size.from(autoPreview.width, autoPreview.height))
          )
          .flat()
      )
      ctx.restore()
    }

    const subjectPreview = subjectMaskSt.previewCanvas.value
    if (subjectMaskSt.enabled.value && subjectPreview && maskApplySt.lassoShown.value) {
      const [offsetX, offsetY] = subjectMaskSt.previewOffset.value
      ctx.save()
      ctx.drawImage(
        subjectPreview,
        0,
        0,
        subjectPreview.width,
        subjectPreview.height,
        ...controlSt.viewport.value
          .toView(
            Box.from(
              Pos.from(offsetX, offsetY),
              Size.from(subjectPreview.width, subjectPreview.height)
            )
          )
          .flat()
      )
      ctx.restore()
    }

    const preview = colorPreviewSt.previewCanvas.value
    if (colorPreviewSt.enabled.value && preview) {
      ctx.save()
      ctx.drawImage(
        preview,
        0,
        0,
        ...imageSt.size.value.flat(),
        ...controlSt.viewport.value.toView(Box.from(new Pos(), imageSt.size.value)).flat()
      )
      ctx.restore()
    }

    for (const step of drawSteps) {
      ctx.save()
      step(ctx, controlSt.viewport.value)
      ctx.restore()
    }

    if (subjectSelectSt.active.value && subjectSelectSt.points.value.length > 1) {
      const view = controlSt.viewport.value
      const first = view.toView(subjectSelectSt.points.value[0]!)
      ctx.save()
      ctx.strokeStyle = 'rgba(80, 160, 255, 0.95)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(first.x, first.y)
      for (const point of subjectSelectSt.points.value.slice(1)) {
        const pos = view.toView(point)
        ctx.lineTo(pos.x, pos.y)
      }
      ctx.stroke()
      ctx.restore()
    }

    if (pickSt.picking.value || pickSt.samplePoints.value.length > 0) {
      ctx.save()
      for (const point of pickSt.samplePoints.value) {
        const viewPos = controlSt.viewport.value.toView(
          Pos.from(point.pos[0] + 0.5, point.pos[1] + 0.5)
        )
        const s = Math.max(2, 1 / controlSt.viewport.value.scale)
        const x = viewPos.x - s / 2
        const y = viewPos.y - s / 2
        ctx.fillStyle = `rgb(${point.color.join(',')})`
        ctx.fillRect(x, y, s, s)
        const lum = 0.299 * point.color[0] + 0.587 * point.color[1] + 0.114 * point.color[2]
        ctx.strokeStyle = lum > 128 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)'
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, s, s)
      }
      ctx.restore()
    }

    if (pickSt.selecting.value && pickSt.selectBox.value) {
      ctx.save()
      ctx.strokeStyle = 'red'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      const box = controlSt.viewport.value.toView(pickSt.selectBox.value)
      ctx.strokeRect(...box.flat())
      ctx.restore()
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

  const cropSize = controlSt.cropBox.value.size
  return settingsSt.selectOutlineOnly.eff && Math.abs(cropSize.w) > 0 && Math.abs(cropSize.h) > 0
}

export function setup(
  sizeEl: Readonly<ShallowRef<HTMLDivElement | null>>,
  canvasEl: Readonly<ShallowRef<HTMLCanvasElement | null>>
) {
  let resizeObs: ResizeObserver | undefined
  let drawRunner: ReactiveEffectRunner<void> | undefined
  let drawFrame: number | undefined
  let animate = false

  const requestDraw = () => {
    if (drawFrame !== undefined || document.hidden) {
      return
    }
    drawFrame = requestAnimationFrame(() => {
      drawFrame = undefined
      drawRunner?.()
      if (animate && document.hasFocus()) {
        requestDraw()
      }
    })
  }

  const onVisibilityChange = () => {
    if (document.hidden) {
      if (drawFrame !== undefined) {
        cancelAnimationFrame(drawFrame)
        drawFrame = undefined
      }
    } else {
      requestDraw()
    }
  }

  watch(
    () => canvasEl.value,
    () => {
      const ctx = canvasEl.value!.getContext('2d')!

      const resize = () => {
        const rec = sizeEl.value!.getBoundingClientRect()
        size.value.set(rec.width, rec.height)
        canvasEl.value!.width = rec.width
        canvasEl.value!.height = rec.height
        requestDraw()
      }
      resizeObs = new ResizeObserver(resize)
      resizeObs.observe(sizeEl.value!)
      resize()

      drawRunner = effect(
        () => {
          animate = draw(ctx)
        },
        {
          scheduler: requestDraw
        }
      )
      if (animate) {
        requestDraw()
      }
    },
    {
      once: true
    }
  )

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('focus', requestDraw)

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('focus', requestDraw)
    resizeObs?.disconnect()
    if (drawFrame !== undefined) {
      cancelAnimationFrame(drawFrame)
    }
    if (drawRunner) {
      stop(drawRunner)
    }
  })
}
