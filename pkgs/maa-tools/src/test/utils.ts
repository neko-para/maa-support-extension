// return if real inside expect
export function checkRect(expect: maa.Rect, real: maa.Rect) {
  return (
    real[0] >= expect[0] &&
    real[1] >= expect[1] &&
    real[0] + real[2] <= expect[0] + expect[2] &&
    real[1] + real[3] <= expect[1] + expect[3]
  )
}
