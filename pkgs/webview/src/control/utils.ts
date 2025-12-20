export function makeBrief(str: string, maxLen = 10, side = 4) {
  if (str.length > maxLen) {
    str = str.substring(0, side) + '..' + str.substring(str.length - side)
  }
  return str
}
