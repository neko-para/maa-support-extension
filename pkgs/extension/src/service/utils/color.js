const color = require('onecolor')

function hsv2rgb(h, s, v) {
  const c = new color.HSV(h / 255, s / 255, v / 255)
  return [c.red() * 255, c.green() * 255, c.blue() * 255]
}

module.exports = {
  hsv2rgb
}
