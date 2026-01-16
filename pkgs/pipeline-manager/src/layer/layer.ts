import type { Node } from 'jsonc-parser'

import type { TaskDeclInfo, TaskInfo, TaskRefInfo } from '../parser/task/task'
import { findDeclRef } from '../utils/helper'

export type LayerTaskInfo = {
  file: string
  prop: Node
  data: Node
  info: TaskInfo
}

export class LayerInfo {
  type: 'interface' | 'resource'

  tasks: Record<string, LayerTaskInfo[]>
  images: Set<string>
  extraRefs: TaskRefInfo[]

  constructor(type: 'interface' | 'resource') {
    this.type = type

    this.tasks = {}
    this.images = new Set()
    this.extraRefs = []
  }

  getTaskInfo(name: string) {
    this.tasks[name] = this.tasks[name] ?? []
    return this.tasks[name]
  }

  mergeDeclsRefs(file: string): [decls: TaskDeclInfo[], refs: TaskRefInfo[]] {
    const result: [decls: TaskDeclInfo[], refs: TaskRefInfo[]] = [[], []]
    for (const [name, taskInfos] of Object.entries(this.tasks)) {
      for (const taskInfo of taskInfos) {
        if (taskInfo.file !== file) {
          continue
        }

        result[0].push(...taskInfo.info.decls)
        result[1].push(...taskInfo.info.refs)
      }
    }
    result[1].push(...this.extraRefs)
    return result
  }
}
