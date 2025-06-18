import { ref } from 'vue'

import { ipc } from '../ipc'

export const picking = ref(false)

export const color = ref<[r: number, g: number, b: number] | null>(null)

export function start() {
  picking.value = true
  color.value = null
}

export function cssText() {
  return color.value ? `#${color.value.map(x => x.toString(16).toUpperCase()).join('')}` : ''
}

export function copyCss() {
  const text = cssText()
  if (text) {
    ipc.send({
      command: 'writeClipboard',
      text
    })
  }
}

export function arrayText() {
  return color.value ? `[${color.value.join(', ')}]` : undefined
}

export function copyArray() {
  const text = arrayText()
  if (text) {
    ipc.send({
      command: 'writeClipboard',
      text
    })
  }
}
