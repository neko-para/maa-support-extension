import { computed, ref, shallowRef } from 'vue'

import * as imageSt from '@/crop/states/image'
import { Box, DragHandler, Pos, Size, Viewport } from '@/crop/utils/2d'
import {
  type CornerType,
  type EdgeType,
  detectCorner,
  detectEdge,
  edgeSide,
  resizeCursor
} from '@/crop/utils/detect'

export const cursor = ref<string>('default')
export const current = ref<Pos>(new Pos())

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

export function onKeyDown(event: KeyboardEvent) {
  // event.metaKey
}

export function onKeyUp(event: KeyboardEvent) {
  // event.metaKey
}

export function onWheel(event: WheelEvent) {
  const mp = Pos.fromEvent(event)
  current.value = mp

  viewport.value.zoom(event.deltaY > 0, mp)
}

export function onPointerDown(event: PointerEvent) {
  const mp = Pos.fromEvent(event)
  current.value = mp

  if (event.ctrlKey) {
    cropBoxDrag.value.down(mp, mp, event)
    cursor.value = 'crosshair'
  } else {
    const corner = detectCorner(cropBoxInView.value, mp)
    if (corner) {
      cornerDragTarget.value = corner
      cornerDrag.value.down(mp, cropBoxInView.value[corner], event)
      return
    }

    const edge = detectEdge(cropBoxInView.value, mp)
    if (edge) {
      const fakePos = new Pos()
      fakePos[edgeSide[edge]] = cropBoxInView.value[edge]
      cornerDragTarget.value = edge
      cornerDrag.value.down(mp, fakePos, event)
      return
    }

    if (cropBoxInView.value.contains(mp)) {
      cropBoxMoveDrag.value.down(mp, cropBoxInView.value.origin, event)
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
    cropBoxInView.value = cropBoxDrag.value.box
  } else if (cornerDrag.value.state) {
    cornerDrag.value.move(mp)
    const dlt = cornerDrag.value.current.sub(cropBoxInView.value.origin)
    const v = cropBoxInView.value.copy()
    for (const ch of cornerDragTarget.value) {
      const cht = ch as EdgeType
      switch (cht) {
        case 'l': {
          v.origin.x = cornerDrag.value.current.x
          v.size.w = v.size.w - dlt.w
          break
        }
        case 't': {
          v.origin.y = cornerDrag.value.current.y
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
    cropBoxInView.value = v
  } else if (cropBoxMoveDrag.value.state) {
    cropBoxMoveDrag.value.move(mp)
    cropBoxInView.value = cropBoxInView.value.copy().setOrigin(cropBoxMoveDrag.value.current)
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

export function copyRoi() {
  navigator.clipboard.writeText(JSON.stringify(cropBox.value.flat()))
}

export function copyRoiExpand() {
  navigator.clipboard.writeText(JSON.stringify(cropBoxExpand.value.flat()))
}
