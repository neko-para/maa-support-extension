import type { TaskDeclInfo, TaskInfo, TaskRefInfo } from '../pipeline/types'
import type { TaskName } from '../types'

export type FileView = {
  readonly path: string
  readonly tasks: ReadonlyMap<TaskName, TaskInfo>
  readonly fileDecls: readonly TaskDeclInfo[]
}

export const FileView = {
  allDecls(view: FileView): TaskDeclInfo[] {
    const result: TaskDeclInfo[] = [...view.fileDecls]
    for (const info of view.tasks.values()) {
      result.push(...info.decls)
    }
    return result
  },

  allRefs(view: FileView): TaskRefInfo[] {
    const result: TaskRefInfo[] = []
    for (const info of view.tasks.values()) {
      result.push(...info.refs)
    }
    return result
  }
}
