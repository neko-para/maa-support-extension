import type { LayerTaskInfo } from '../../layer/layer'
import type { TaskDeclInfo, TaskRefInfo } from '../../parser/task/task'
import type { AbsolutePath, TaskName } from '../../utils/types'

export class TaskStore {
  tasks: Record<TaskName, LayerTaskInfo[]>
  extraDecls: TaskDeclInfo[]
  extraRefs: TaskRefInfo[]

  constructor() {
    this.tasks = {}
    this.extraDecls = []
    this.extraRefs = []
  }

  reset() {
    this.tasks = {}
    this.extraDecls = []
    this.extraRefs = []
  }

  mutableInfo(name: TaskName) {
    this.tasks[name] = this.tasks[name] ?? []
    return this.tasks[name]
  }

  list(): TaskName[] {
    return Object.keys(this.tasks).filter(task => !task.startsWith('$')) as TaskName[]
  }

  removeFile(file: AbsolutePath): string[] {
    const changed: string[] = []
    for (const [task, infos] of Object.entries(this.tasks)) {
      const filtered = infos.filter(info => info.file !== file)
      if (infos.length !== filtered.length) {
        if (filtered.length === 0) {
          delete this.tasks[task as TaskName]
        } else {
          infos.splice(0, infos.length, ...filtered)
        }
        changed.push(task)
      }
    }
    this.extraDecls = this.extraDecls.filter(decl => decl.file !== file)
    this.extraRefs = this.extraRefs.filter(ref => ref.file !== file)
    return changed
  }

  collectDecls(): TaskDeclInfo[] {
    const result: TaskDeclInfo[] = []
    for (const infos of Object.values(this.tasks)) {
      for (const info of infos) {
        result.push(...info.info.decls)
      }
    }
    result.push(...this.extraDecls)
    return result
  }

  collectRefs(): TaskRefInfo[] {
    const result: TaskRefInfo[] = []
    for (const infos of Object.values(this.tasks)) {
      for (const info of infos) {
        result.push(...info.info.refs)
      }
    }
    result.push(...this.extraRefs)
    return result
  }
}
