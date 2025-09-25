import type { AllVirts } from './types'

export const TaskBaseProps = [
  '__baseTaskResolved',
  'baseTask',
  'algorithm',
  'action',
  'sub',
  'subErrorIgnored',
  'next',
  'maxTimes',
  'exceededNext',
  'onErrorNext',
  'preDelay',
  'postDelay',
  'roi',
  'cache',
  'rectMove',
  'reduceOtherTimes',
  'specificRect',
  'specialParams',
  'highResolutionSwipeFix'
] as const

export const TaskExprProps = [
  'sub',
  'next',
  'exceededNext',
  'onErrorNext',
  'reduceOtherTimes'
] as const
export const TaskExprVirts = [
  'sub',
  'next',
  'exceeded_next',
  'on_error_next',
  'reduce_other_times'
] as const
export const TaskExprPropsVirtsMap = {
  sub: 'sub',
  next: 'next',
  exceededNext: 'exceeded_next',
  onErrorNext: 'on_error_next',
  reduceOtherTimes: 'reduce_other_times'
} as const

export function shouldStrip(prop: AllVirts) {
  return ['next', 'exceeded_next', 'on_error_next'].includes(prop)
}
