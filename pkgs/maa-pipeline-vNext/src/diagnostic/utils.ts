import type { TaskRefInfo } from '../pipeline/types'
import type { TaskName } from '../types'
import type { AnchorName, ImageRelativePath } from '../types'

export function taskRefTarget(r: TaskRefInfo): TaskName | null {
  if (
    r.type === 'task.anchor' ||
    r.type === 'task.reco' ||
    r.type === 'task.color_filter' ||
    r.type === 'task.custom_task' ||
    r.type === 'task.entry'
  ) {
    return r.target
  }
  if (r.type === 'task.next' || r.type === 'task.roi' || r.type === 'task.target') {
    if (r.attrs.attrs.Anchor) {
      return null
    }
    if (r.type === 'task.roi' && r.prevRef) {
      return null
    }
    return r.target
  }
  return null
}

export function imageRefTarget(r: TaskRefInfo): ImageRelativePath | null {
  if (r.type === 'task.template' || r.type === 'task.custom_template') {
    return r.target
  }
  return null
}

export function anchorRefTarget(r: TaskRefInfo): AnchorName | null {
  if (
    (r.type === 'task.next' ||
      r.type === 'task.roi' ||
      r.type === 'task.target' ||
      r.type === 'task.custom_anchor') &&
    r.attrs.attrs.Anchor
  ) {
    return r.target as AnchorName
  }
  return null
}
