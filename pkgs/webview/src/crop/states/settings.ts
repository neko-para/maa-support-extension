import { ref } from 'vue'

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
