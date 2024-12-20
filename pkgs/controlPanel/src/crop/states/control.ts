import { ref } from 'vue'

import { Pos, Viewport } from '@/crop/utils/2d'

export const cursor = ref<string>('default')
export const current = ref<Pos>(new Pos())

export const viewport = ref(new Viewport())

export function onWheel(event: WheelEvent) {
  current.value = Pos.fromEvent(event)
}

export function onPointerDown(event: PointerEvent) {
  current.value = Pos.fromEvent(event)
}

export function onPointerMove(event: PointerEvent) {
  current.value = Pos.fromEvent(event)
}

export function onPointerUp(event: PointerEvent) {
  current.value = Pos.fromEvent(event)
}

export function onContextMenu(event: MouseEvent) {
  event.preventDefault()
  current.value = Pos.fromEvent(event)
}
