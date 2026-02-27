import color from 'onecolor'

export function hsv2rgb(h, s, v) {
  const c = new color.HSV(h / 179, s / 255, v / 255)
  return [c.red() * 255, c.green() * 255, c.blue() * 255]
}
