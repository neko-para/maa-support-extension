import { computed, ref } from 'vue'

import type { CropHostState } from '@mse/types'

import { hostState } from '../state'

export const show = ref(false)

export function toggleShow() {
  show.value = !show.value
}

export const isColor = (color: string | undefined): color is string => {
  if (!color) {
    return false
  }

  const s = new Option().style
  s.color = color
  return s.color !== ''
}

export const isFont = (font: string | undefined): font is string => {
  if (!font) {
    return false
  }

  const s = new Option().style
  s.font = font
  return s.font !== ''
}

export const colorWithDefault = (color: string | undefined, def: string) => {
  return isColor(color) ? color : def
}

export const fontWithDefault = (font: string | undefined, def: string) => {
  return isFont(font) ? font : def
}

export const toAlpha = (value: string | undefined, def: number) => {
  if (!value) {
    return def
  }
  const v = parseFloat(value)
  return isNaN(v) ? def : v < 0 ? 0 : v > 1 ? 1 : v
}

function makeSettings(key: keyof CropHostState) {
  return computed<string | undefined>({
    get() {
      return hostState.value[key]
    },
    set(v) {
      hostState.value[key] = v
    }
  })
}

function makeBoolSettings(key: keyof CropHostState) {
  return computed<boolean>({
    get() {
      return hostState.value[key] === 'true'
    },
    set(v) {
      hostState.value[key] = v ? 'true' : 'false'
    }
  })
}

function makeIntegerSettings(key: keyof CropHostState) {
  return computed<number | undefined>({
    get() {
      if (!hostState.value[key]) {
        return undefined
      }
      const v = parseInt(hostState.value[key])
      return isNaN(v) ? undefined : v
    },
    set(v) {
      hostState.value[key] = v?.toString()
    }
  })
}

function makeFloatSettings(key: keyof CropHostState) {
  return computed<number | undefined>({
    get() {
      if (!hostState.value[key]) {
        return undefined
      }
      const v = parseFloat(hostState.value[key])
      return isNaN(v) ? undefined : v
    },
    set(v) {
      hostState.value[key] = v?.toString()
    }
  })
}

export const backgroundFill = makeSettings('backgroundFill')
export const selectFill = makeSettings('selectFill')
export const selectOpacity = makeSettings('selectOpacity')
export const pointerAxesStroke = makeSettings('pointerAxesStroke')
export const helperAxesStroke = makeSettings('helperAxesStroke')
export const helperAxesOpacity = makeSettings('helperAxesOpacity')
export const helperAxesOverflow = makeBoolSettings('helperAxesOverflow')
export const helperAxesRadius = makeIntegerSettings('helperAxesRadius')
export const helperAxesThreshold = makeFloatSettings('helperAxesThreshold')
export const ocrStroke = makeSettings('ocrStroke')
export const ocrFont = makeSettings('ocrFont')
export const recoStroke = makeSettings('recoStroke')
export const recoFont = makeSettings('recoFont')
