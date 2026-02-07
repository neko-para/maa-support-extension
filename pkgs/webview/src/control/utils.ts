export function makeBrief(str: string, maxLen = 20, side = 8) {
  if (str.length > maxLen) {
    str = str.substring(0, side) + '..' + str.substring(str.length - side)
  }
  return str
}
