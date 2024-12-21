import { computed, ref, shallowRef } from 'vue'

import * as imageSt from '@/crop/states/image'
import { Box, DragHandler, Pos, Size, Viewport } from '@/crop/utils/2d'

import { checkCtrl } from './ua'

export const cursor = ref<string>('default')
export const current = ref<Pos>(new Pos())

export const viewport = ref(new Viewport())
const viewportMoveDrag = ref<DragHandler>(new DragHandler())

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
const cropBoxMoveDrag = ref<DragHandler>(new DragHandler())

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

  if (checkCtrl(event)) {
    cropBoxMoveDrag.value.down(mp, mp, event)
    cursor.value = 'crosshair'
  } else {
    viewportMoveDrag.value.down(mp, viewport.value.offset, event)
    cursor.value = 'grab'
  }
}

export function onPointerMove(event: PointerEvent) {
  const mp = Pos.fromEvent(event)
  current.value = mp

  if (viewportMoveDrag.value.state) {
    viewportMoveDrag.value.move(mp)
    viewport.value.offset = viewportMoveDrag.value.current
  } else if (cropBoxMoveDrag.value.state) {
    cropBoxMoveDrag.value.move(mp)
    cropBoxInView.value = cropBoxMoveDrag.value.box
  }
}

export function onPointerUp(event: PointerEvent) {
  const mp = Pos.fromEvent(event)
  current.value = mp

  if (viewportMoveDrag.value.state) {
    viewportMoveDrag.value.up(event)
    cursor.value = 'default'
  } else if (cropBoxMoveDrag.value.state) {
    cropBoxMoveDrag.value.up(event)
    cursor.value = 'default'
  }
}

export function onContextMenu(event: MouseEvent) {
  current.value = Pos.fromEvent(event)
}
