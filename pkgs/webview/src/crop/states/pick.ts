import { computed, ref } from 'vue'

import { ipc } from '../ipc'

export const picking = ref(false)

export const color = ref<[r: number, g: number, b: number] | null>(null)

export const hsvColor = computed<[h: number, s: number, v: number] | null>(() => {
  if (!color.value) {
    return null
  }
  const [r, g, b] = color.value

  const rp = r / 255
  const gp = g / 255
  const bp = b / 255

  const cmax = Math.max(rp, gp, bp)
  const cmin = Math.min(rp, gp, bp)
  const dlt = cmax - cmin

  let h: number, s: number, v: number

  v = cmax

  if (cmax === 0) {
    s = 0
  } else {
    s = dlt / cmax
  }

  if (dlt === 0) {
    h = 0
  } else if (cmax === rp) {
    h = (gp - bp) / dlt
  } else if (cmax === gp) {
    h = (bp - rp) / dlt + 2
  } else {
    h = (rp - gp) / dlt + 4
  }
  h = h % 6
  if (h < 0) {
    h = h + 6
  }
  h = h * 60

  return [Math.round(h), Math.round(s * 255), Math.round(v * 255)]
})

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

export function hsvText() {
  if (!hsvColor.value) {
    return undefined
  }
  return `[${hsvColor.value.join(', ')}]`
}

export function copyHsv() {
  const text = hsvText()
  if (text) {
    ipc.send({
      command: 'writeClipboard',
      text
    })
  }
}
