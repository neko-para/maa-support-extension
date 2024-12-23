import { computed, ref } from 'vue'

import { ipc } from '@/crop/main'

export const show = ref(false)

export function toggleShow() {
  show.value = !show.value
}

export const isColor = (strColor: string | undefined): strColor is string => {
  if (!strColor) {
    return false
  }

  const s = new Option().style
  s.color = strColor
  return s.color !== ''
}

export const colorWithDefault = (color: string | undefined, def: string) => {
  return isColor(color) ? color : def
}

export const toAlpha = (value: string | undefined, def: number) => {
  if (!value) {
    return def
  }
  const v = parseFloat(value)
  return isNaN(v) ? def : v < 0 ? 0 : v > 1 ? 1 : v
}

function makeSettings(key: keyof typeof ipc.context.value) {
  return computed<string | undefined>({
    get() {
      return ipc.context.value[key]
    },
    set(v) {
      ipc.context.value[key] = v
    }
  })
}

export const backgroundFill = makeSettings('backgroundFill')
export const selectFill = makeSettings('selectFill')
export const selectOpacity = makeSettings('selectOpacity')
export const pointerAxesStroke = makeSettings('pointerAxesStroke')
export const ocrStroke = makeSettings('ocrStroke')
// export const pixelBoundStroke = makeColorSettings('pixelBoundStroke')
