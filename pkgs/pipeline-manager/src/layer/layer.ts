import type { Node } from 'jsonc-parser'

import type { IContentLoader } from '../content/loader'
import type { TaskAnchorDeclInfo, TaskDeclInfo, TaskInfo, TaskRefInfo } from '../parser/task/task'
import type { AbsolutePath, AnchorName, ImageRelativePath, TaskName } from '../utils/types'

export type LayerTaskInfo = {
  file: AbsolutePath
  prop: Node
  data: Node
  info: TaskInfo
}

export class LayerInfo {
  loader: IContentLoader

  root: AbsolutePath
  parent?: LayerInfo

  type: 'interface' | 'resource'

  tasks: Record<TaskName, LayerTaskInfo[]>
  images: Set<ImageRelativePath>
  extraRefs: TaskRefInfo[]

  constructor(loader: IContentLoader, root: AbsolutePath, type: 'interface' | 'resource') {
    this.loader = loader
    this.root = root
    this.type = type

    this.tasks = {}
    this.images = new Set()
    this.extraRefs = []
  }

  mutableTaskInfo(name: TaskName) {
    this.tasks[name] = this.tasks[name] ?? []
    return this.tasks[name]
  }

  mergeDeclsRefs(file?: AbsolutePath): [decls: TaskDeclInfo[], refs: TaskRefInfo[]] {
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

  mergeDeclsWithFile(): [decl: TaskDeclInfo, file: AbsolutePath][] {
    type Result = [decl: TaskDeclInfo, file: AbsolutePath]
    const result: Result[] = []
    for (const [name, taskInfos] of Object.entries(this.tasks)) {
      for (const taskInfo of taskInfos) {
        result.push(...taskInfo.info.decls.map(decl => [decl, taskInfo.file] as Result))
      }
    }
    return result
  }

  getTaskList(): TaskName[] {
    const tasks = this.parent?.getTaskList() ?? []
    tasks.push(...(Object.keys(this.tasks) as TaskName[]))
    return [...new Set(tasks)]
  }

  getAnchorList(): [anchor: AnchorName, decl: TaskAnchorDeclInfo][] {
    const anchors = this.parent?.getAnchorList() ?? []
    const [decls, refs] = this.mergeDeclsRefs()
    anchors.push(
      ...decls
        .filter(decls => decls.type === 'task.anchor')
        .map(decl => [decl.anchor, decl] as [anchor: AnchorName, decl: TaskAnchorDeclInfo])
    )
    return anchors
  }

  getImageList(): ImageRelativePath[] {
    const images = this.parent?.getImageList() ?? []
    images.push(...this.images)
    return [...new Set(images)]
  }

  getTask(task: TaskName): { layer: LayerInfo; infos: LayerTaskInfo[] }[] {
    const tasks = this.parent?.getTask(task) ?? []
    tasks.unshift({
      layer: this,
      infos: this.tasks[task] ?? []
    })
    return tasks.filter(x => x.infos.length > 0)
  }

  getImage(image: ImageRelativePath): LayerInfo[] {
    const layers = this.parent?.getImage(image) ?? []
    if (this.images.has(image)) {
      layers.unshift(this)
    }
    return layers
  }

  getTaskBriefInfo(task: TaskName) {
    const result: {
      reco?: maa.RecognitionType
      act?: maa.ActionType
    } = {}
    for (const { layer, infos } of this.getTask(task)) {
      for (const info of infos) {
        if (!result.reco && info.info.parts.recoType) {
          result.reco = info.info.parts.recoType.value as maa.RecognitionType
        } else if (!result.act && info.info.parts.actType) {
          result.act = info.info.parts.actType.value as maa.ActionType
        }
        if (result.reco && result.act) {
          return result
        }
      }
    }

    return result
  }
}
