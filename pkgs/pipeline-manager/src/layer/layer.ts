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
  parent?: LayerInfo

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

  mergeDeclsRefs(file?: string): [decls: TaskDeclInfo[], refs: TaskRefInfo[]] {
    const result: [decls: TaskDeclInfo[], refs: TaskRefInfo[]] = [[], []]
    for (const [name, taskInfos] of Object.entries(this.tasks)) {
      for (const taskInfo of taskInfos) {
        if (file && taskInfo.file !== file) {
          continue
        }

        result[0].push(...taskInfo.info.decls)
        result[1].push(...taskInfo.info.refs)
      }
    }
    result[1].push(...this.extraRefs)
    return result
  }

  getTaskList(): string[] {
    const tasks = this.parent?.getTaskList() ?? []
    tasks.push(...Object.keys(this.tasks))
    return [...new Set(tasks)]
  }

  getAnchorList(): string[] {
    const anchors = this.parent?.getTaskList() ?? []
    const [decls, refs] = this.mergeDeclsRefs()
    anchors.push(...decls.filter(decls => decls.type === 'task.anchor').map(decl => decl.anchor))
    return [...new Set(anchors)]
  }

  getImageList(): string[] {
    const images = this.parent?.getImageList() ?? []
    images.push(...this.images)
    return [...new Set(images)]
  }
}
