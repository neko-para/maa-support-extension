export function makeBrief(str: string, maxLen = 10) {
  if (str.length > maxLen) {
    str = str.substring(0, maxLen - 6) + '..' + str.substring(str.length - 4)
  }
  return str
}
