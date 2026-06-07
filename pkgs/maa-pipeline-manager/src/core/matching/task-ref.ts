import type { TaskRefInfo } from '../../parser/task/task'
import type { TaskName } from '../../utils/types'

export function extractTaskRef(r: TaskRefInfo): TaskName | null {
  if (
    r.type === 'task.anchor' ||
    r.type === 'task.reco' ||
    r.type === 'task.color_filter' ||
    r.type === 'task.custom_task' ||
    r.type === 'task.entry'
  ) {
    return r.target
  } else if (r.type === 'task.next' || r.type === 'task.roi' || r.type === 'task.target') {
    if (r.attrs.attrs.Anchor) {
      return null
    }
    if (r.type === 'task.roi' && r.prevRef) {
      return null
    }
    return r.target
  } else {
    return null
  }
}

export function isAnchorRef(r: TaskRefInfo): r is TaskRefInfo & {
  type: 'task.next' | 'task.roi' | 'task.target' | 'task.custom_anchor'
  attrs: { attrs: { Anchor: true } }
} {
  return (
    (r.type === 'task.next' ||
      r.type === 'task.roi' ||
      r.type === 'task.target' ||
      r.type === 'task.custom_anchor') &&
    !!r.attrs.attrs.Anchor
  )
}
