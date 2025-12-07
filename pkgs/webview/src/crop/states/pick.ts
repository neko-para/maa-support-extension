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

export function arrayText(threshold: number) {
  if (!color.value) {
    return undefined
  }
  return `[${color.value.map(x => Math.min(Math.max(x + threshold, 0), 255)).join(', ')}]`
}

export function copyArray(threshold: number) {
  const text = arrayText(threshold)
  if (text) {
    ipc.send({
      command: 'writeClipboard',
      text
    })
  }
}
