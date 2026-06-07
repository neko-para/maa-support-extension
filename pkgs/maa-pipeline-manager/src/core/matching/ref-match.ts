import type { TaskDeclInfo, TaskRefInfo } from '../../parser/task/task'
import type { AnchorName, TaskName } from '../../utils/types'
import { extractTaskRef, isAnchorRef } from './task-ref'

function findTaskRefs(refs: TaskRefInfo[], task: TaskName): TaskRefInfo[] {
  return refs.filter(r => {
    if (
      r.type === 'task.anchor' ||
      r.type === 'task.reco' ||
      r.type === 'task.color_filter' ||
      r.type === 'task.custom_task' ||
      r.type === 'task.entry'
    ) {
      return r.target === task
    } else if (r.type === 'task.next' || r.type === 'task.target') {
      return r.target === task && !r.attrs.attrs.Anchor
    } else if (r.type === 'task.roi' && !r.attrs.attrs.Anchor) {
      const prev = r.prev.filter(decl => decl.value === r.target)
      return prev.length === 0 && r.target === task
    } else {
      return false
    }
  })
}

export function findMatchingRefs(
  _decls: TaskDeclInfo[],
  refs: TaskRefInfo[],
  decl: TaskDeclInfo | null,
  ref: TaskRefInfo | null
): TaskRefInfo[] {
  if (decl) {
    if (decl.type === 'task.decl') {
      return findTaskRefs(refs, decl.task)
    } else if (decl.type === 'task.anchor') {
      return refs.filter(r => isAnchorRef(r) && (r.target as string as AnchorName) === decl.anchor)
    } else if (decl.type === 'task.sub_reco') {
      return refs.filter(
        r => r.type === 'task.roi' && r.target === decl.name && r.task === decl.task
      )
    } else if (decl.type === 'task.locale') {
      return refs.filter(r => r.type === 'task.locale' && r.target === decl.key)
    }
  } else if (ref) {
    const task = extractTaskRef(ref)
    if (task) {
      return findTaskRefs(refs, task)
    } else if (isAnchorRef(ref)) {
      return refs.filter(r => isAnchorRef(r) && r.target === ref.target)
    } else if (ref.type === 'task.roi') {
      return refs.filter(
        r => r.type === 'task.roi' && r.target === ref.target && r.task === ref.task
      )
    } else if (ref.type === 'task.locale') {
      return refs.filter(r => r.type === 'task.locale' && r.target === ref.target)
    }
  }
  return []
}
