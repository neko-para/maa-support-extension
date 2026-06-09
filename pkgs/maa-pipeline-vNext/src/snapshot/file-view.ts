import type { TaskDeclInFile, TaskInfoInFile, TaskRefInFile } from '../pipeline/types'
import type { AbsolutePath, TaskName } from '../types'

export type FileView = {
  readonly path: AbsolutePath
  /** 任务定义——所有 decl/ref 已标注所属文件 */
  readonly tasks: ReadonlyMap<TaskName, TaskInfoInFile>
  /** 文件级声明（如 mpe_config）——已标注所属文件 */
  readonly fileDecls: readonly TaskDeclInFile[]
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
