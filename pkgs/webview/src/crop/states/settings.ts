import { computed, reactive } from 'vue'

import type { CropSettings } from '@mse/types'

import { ipc } from '../ipc'
import { hostState } from '../state'

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

export const toAlpha = (value: number | undefined, def: number) => {
  if (!!!value) {
    return def
  }
  return isNaN(value) ? def : value < 0 ? 0 : value > 1 ? 1 : value
}

export type SettingsInstance<T> = {
  val: T | undefined
  readonly eff: T
  readonly def: T
}

function useSetting<K extends keyof CropSettings>(
  key: K,
  def: NonNullable<CropSettings[K]>,
  validate?: (val: NonNullable<CropSettings[K]>) => boolean
) {
  validate = validate ?? (() => true)

  const val = computed<CropSettings[K]>({
    set(val) {
      ipc.send({
        command: 'updateSettings',
        key,
        value: val
      })
    },
    get() {
      return hostState.value[key]
    }
  })
  const eff = computed<NonNullable<CropSettings[K]>>(() => {
    const val = hostState.value[key] ?? def
    return validate(val) ? val : def
  })
  return reactive({
    val,
    eff,
    def
  }) as SettingsInstance<NonNullable<CropSettings[K]>>
}

export const saveAddRoiInfo = useSetting('saveAddRoiInfo', false)
export const backgroundFill = useSetting('backgroundFill', 'white', isColor)
export const selectFill = useSetting('selectFill', 'wheat', isColor)
export const selectOpacity = useSetting('selectOpacity', 0.3)
export const selectOutlineOnly = useSetting('selectOutlineOnly', false)
export const selectOutlineThickness = useSetting('selectOutlineThickness', 1)
export const revertScale = useSetting('revertScale', false)
export const pointerAxesStroke = useSetting('pointerAxesStroke', 'rgba(255, 127, 127, 1)', isColor)
export const helperAxesStroke = useSetting('helperAxesStroke', 'white', isColor)
export const helperAxesOpacity = useSetting('helperAxesOpacity', 0.4)
export const helperAxesOverflow = useSetting('helperAxesOverflow', false)
export const helperAxesRadius = useSetting('helperAxesRadius', 20)
export const helperAxesThreshold = useSetting('helperAxesThreshold', 10)
export const pickColorThreshold = useSetting('pickColorThreshold', 10)
export const templateMatchThreshold = useSetting('templateMatchThreshold', 0.8)
export const ocrStroke = useSetting('ocrStroke', 'green', isColor)
export const ocrFont = useSetting('ocrFont', '24pt consolas', isFont)
export const recoStroke = useSetting('recoStroke', 'green', isColor)
export const recoFont = useSetting('recoFont', '24pt consolas', isFont)
