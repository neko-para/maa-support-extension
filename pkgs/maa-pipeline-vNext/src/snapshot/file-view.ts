import type { TaskDeclInFile, TaskInfoInFile, TaskRefInFile } from '../pipeline/types'
import type { AbsolutePath, TaskName } from '../types'

export type FileView = {
  readonly path: AbsolutePath
  /** 按出现顺序排列。同名 task 允许多条（如 interface override 场景）。 */
  readonly tasks: ReadonlyMap<TaskName, readonly TaskInfoInFile[]>
  readonly fileDecls: readonly TaskDeclInFile[]
  readonly isDefault: boolean
}

export const FileView = {
  allDecls(view: FileView): TaskDeclInFile[] {
    const result: TaskDeclInFile[] = [...view.fileDecls]
    for (const infos of view.tasks.values()) {
      for (const info of infos) {
        result.push(...info.decls)
      }
    }
    return result
  },

  allRefs(view: FileView): TaskRefInFile[] {
    const result: TaskRefInFile[] = []
    for (const infos of view.tasks.values()) {
      for (const info of infos) {
        result.push(...info.refs)
      }
    }
    return result
  }
}
