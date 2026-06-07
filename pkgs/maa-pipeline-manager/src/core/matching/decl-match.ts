import type { TaskDeclInfo, TaskRefInfo } from '../../parser/task/task'
import type { AnchorName } from '../../utils/types'
import { extractTaskRef, isAnchorRef } from './task-ref'

export function findMatchingDecls(
  decls: TaskDeclInfo[],
  _refs: TaskRefInfo[],
  decl: TaskDeclInfo | null,
  ref: TaskRefInfo | null
): TaskDeclInfo[] {
  if (decl) {
    if (decl.type === 'task.decl') {
      return decls.filter(d => d.type === 'task.decl' && d.task === decl.task)
    } else if (decl.type === 'task.anchor') {
      return decls.filter(d => d.type === 'task.anchor' && d.anchor === decl.anchor)
    } else if (decl.type === 'task.sub_reco') {
      return decls.filter(
        d => d.type === 'task.sub_reco' && d.name === decl.name && d.task === decl.task
      )
    } else if (decl.type === 'task.locale') {
      return decls.filter(d => d.type === 'task.locale' && d.key === decl.key)
    }
  } else if (ref) {
    const task = extractTaskRef(ref)
    if (task && 'target' in ref) {
      return decls.filter(d => d.type === 'task.decl' && d.task === ref.target)
    } else if (isAnchorRef(ref)) {
      return decls.filter(
        d => d.type === 'task.anchor' && d.anchor === (ref.target as string as AnchorName)
      )
    } else if (ref.type === 'task.roi') {
      return decls.filter(
        d => d.type === 'task.sub_reco' && d.name === ref.target && d.task === ref.task
      )
    } else if (ref.type === 'task.locale') {
      return decls.filter(d => d.type === 'task.locale' && d.key === ref.target)
    }
  }
  return []
}
