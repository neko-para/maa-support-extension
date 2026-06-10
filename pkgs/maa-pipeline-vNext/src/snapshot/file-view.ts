import type { TaskDeclInFile, TaskInfoInFile, TaskRefInFile } from '../pipeline/types'
import type { AbsolutePath, TaskName } from '../types'

export type FileView = {
  readonly path: AbsolutePath
  readonly tasks: ReadonlyMap<TaskName, TaskInfoInFile>
  readonly fileDecls: readonly TaskDeclInFile[]
  readonly isDefault: boolean
}

export const FileView = {
  allDecls(view: FileView): TaskDeclInFile[] {
    const result: TaskDeclInFile[] = [...view.fileDecls]
    for (const info of view.tasks.values()) {
      result.push(...info.decls)
    }
    return result
  },

  allRefs(view: FileView): TaskRefInFile[] {
    const result: TaskRefInFile[] = []
    for (const info of view.tasks.values()) {
      result.push(...info.refs)
    }
    return result
  }
}
