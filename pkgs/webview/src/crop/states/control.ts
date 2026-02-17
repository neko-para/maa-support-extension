import { computed, ref, shallowRef } from 'vue'

import { ipc } from '../ipc'
import { Box, DragHandler, Pos, Size, Viewport } from '../utils/2d'
import {
  type CornerType,
  type EdgeType,
  detectCorner,
  detectEdge,
  edgeSide,
  resizeCursor
} from '../utils/detect'
import * as imageSt from './image'
import * as pickSt from './pick'
import * as settingsSt from './settings'

export const cursor = ref<string>('default')
export const current = ref<Pos>(new Pos())
export const currentInView = computed(() => {
  return viewport.value.fromView(current.value).round()
})

export const viewport = ref(new Viewport())
const viewportDrag = ref<DragHandler>(new DragHandler())

export const cropBox = ref<Box>(new Box())
export const cropBoxExpand = computed<Box>(() => {
  return cropBox.value
    .copy()
    .setOrigin(cropBox.value.origin.sub(Size.from(50, 50)))
    .setSize(cropBox.value.size.add(Size.from(100, 100)))
    .intersect(Box.from(new Pos(), imageSt.size.value))
})
export const cropBoxInView = computed({
  get() {
    return viewport.value.toView(cropBox.value)
  },
  set(b: Box) {
    cropBox.value = viewport.value.fromView(b)
  }
})
const cropBoxDrag = ref<DragHandler>(new DragHandler())
const cropBoxMoveDrag = ref<DragHandler>(new DragHandler())

const cornerDrag = ref<DragHandler>(new DragHandler())
const cornerDragTarget = ref<CornerType | EdgeType>('lt')
const cornerDragInitialBox = ref<Box>(new Box())

export function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    cropBox.value = new Box()
  }
  // event.metaKey
}

export function onKeyUp(event: KeyboardEvent) {
  // event.metaKey
}

export function onWheel(event: WheelEvent) {
  const mp = Pos.fromEvent(event)
  current.value = mp

  const zoomIn = settingsSt.revertScale.eff ? event.deltaY < 0 : event.deltaY > 0
  viewport.value.zoom(zoomIn, mp)

  if (viewportDrag.value.state) {
    viewportDrag.value.base = viewport.value.offset.sub(viewportDrag.value.delta)
  }
}

export function onPointerDown(event: PointerEvent) {
  const mp = Pos.fromEvent(event)
  current.value = mp

  pickSt.picking.value = false

  if (event.button === 1) {
    viewportDrag.value.down(mp, viewport.value.offset, event)
    cursor.value = 'grab'
    return
  }

  if (event.ctrlKey) {
    cropBoxDrag.value.down(mp, mp, event, viewport.value)
    cursor.value = 'crosshair'
  } else {
    const corner = detectCorner(cropBoxInView.value, mp)
    if (corner) {
      cornerDragTarget.value = corner
      cornerDragInitialBox.value = cropBox.value.copy()
      cornerDrag.value.down(mp, cropBoxInView.value[corner], event, viewport.value)
      return
    }

    const edge = detectEdge(cropBoxInView.value, mp)
    if (edge) {
      const fakePos = new Pos()
      fakePos[edgeSide[edge]] = cropBoxInView.value[edge]
      cornerDragTarget.value = edge
      cornerDragInitialBox.value = cropBox.value.copy()
      cornerDrag.value.down(mp, fakePos, event, viewport.value)
      return
    }

    if (cropBoxInView.value.contains(mp)) {
      cropBoxMoveDrag.value.down(mp, cropBoxInView.value.origin, event, viewport.value)
      cursor.value = 'grab'
      return
    }

    viewportDrag.value.down(mp, viewport.value.offset, event)
    cursor.value = 'grab'
  }
}

export function onPointerMove(event: PointerEvent) {
  const mp = Pos.fromEvent(event)
  current.value = mp

  if (viewportDrag.value.state) {
    viewportDrag.value.move(mp)
    viewport.value.offset = viewportDrag.value.current
  } else if (cropBoxDrag.value.state) {
    cropBoxDrag.value.move(mp)
    cropBox.value = cropBoxDrag.value.box
  } else if (cornerDrag.value.state) {
    cornerDrag.value.move(mp)
    const currentModel = cornerDrag.value.current
    const v = cornerDragInitialBox.value.copy()
    const dlt = currentModel.sub(v.origin)
    for (const ch of cornerDragTarget.value) {
      const cht = ch as EdgeType
      switch (cht) {
        case 'l': {
          v.origin.x = currentModel.x
          v.size.w = v.size.w - dlt.w
          break
        }
        case 't': {
          v.origin.y = currentModel.y
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
    cropBox.value = v
  } else if (cropBoxMoveDrag.value.state) {
    cropBoxMoveDrag.value.move(mp)
    cropBox.value = cropBox.value.copy().setOrigin(cropBoxMoveDrag.value.current)
  } else {
    const corner = detectCorner(cropBoxInView.value, mp)
    const edge = detectEdge(cropBoxInView.value, mp)
    cursor.value = resizeCursor[corner ?? edge ?? 'def']
  }
}

export function onPointerUp(event: PointerEvent) {
  const mp = Pos.fromEvent(event)
  current.value = mp

  for (const drag of [viewportDrag, cropBoxDrag, cornerDrag, cropBoxMoveDrag]) {
    if (drag.value.state) {
      drag.value.up(event)
      cursor.value = 'default'
      break
    }
  }
}

export function onContextMenu(event: MouseEvent) {
  current.value = Pos.fromEvent(event)
}

export function cropCeil() {
  cropBox.value.ceil()
}

export function cropBound() {
  cropBox.value = cropBox.value.intersect(Box.from(new Pos(), imageSt.size.value))
}

export function extractRect(text: string): [number, number, number, number] | null {
  text = text.trim()
  text = text.replaceAll(/^\[(.+)\]$/g, '$1')
  const nums = text
    .split(/[ \t\n_,]+/)
    .filter(x => !!x)
    .map(x => {
      return parseInt(x)
    })
    .filter(x => !isNaN(x))
  if (nums.length !== 4) {
    return null
  }
  return nums as [number, number, number, number]
}

export function roiText() {
  return JSON.stringify(cropBox.value.ceiled().flat())
}

export function roiDisp() {
  return cropBox.value.ceiled().flat().join(', ')
}

export async function readClipboard() {
  return (await ipc.call({ command: 'readClipboard' })) as string
}

export function writeClipboard(text: string) {
  ipc.send({
    command: 'writeClipboard',
    text
  })
}

export function copyRoi() {
  writeClipboard(roiText())
}

export async function pasteRoi() {
  const pb = await readClipboard()
  const rect = extractRect(pb)
  if (rect) {
    cropBox.value.set(Pos.from(rect[0], rect[1]), Size.from(rect[2], rect[3]))
  }
}

export function roiExpandText() {
  return JSON.stringify(cropBoxExpand.value.ceiled().flat())
}

export function roiExpandDisp() {
  return cropBoxExpand.value.ceiled().flat().join(', ')
}

export function copyRoiExpand() {
  writeClipboard(roiExpandText())
}
