import type { Node } from 'jsonc-parser'

import type { IContentLoader } from '../content/loader'
import type { TaskAnchorDeclInfo, TaskDeclInfo, TaskInfo, TaskRefInfo } from '../parser/task/task'
import type { StringNode } from '../parser/utils'
import { buildTree } from '../utils/json'
import {
  type AbsolutePath,
  type AnchorName,
  type ImageRelativePath,
  type TaskName,
  joinImagePath
} from '../utils/types'

export type LayerTaskInfo = {
  file: AbsolutePath
  prop: StringNode
  data: Node
  info: TaskInfo
  obj: unknown
}

function specialStringify(value: any, indent: string, indentCount: number): string {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]'
    }
    const result: string[] = ['[']
    for (const val of value) {
      result.push(indent.repeat(indentCount) + specialStringify(val, indent, indentCount + 1) + ',')
    }
    result.push(indent.repeat(indentCount - 1) + ']')
    return result.join('\n')
  } else if (typeof value === 'object') {
    if (Object.keys(value).length === 0) {
      return '{}'
    }
    const result: string[] = ['{']
    for (const [key, val] of Object.entries(value)) {
      result.push(
        indent.repeat(indentCount) +
          JSON.stringify(key) +
          ': ' +
          specialStringify(val, indent, indentCount + 1) +
          ','
      )
    }
    result.push(indent.repeat(indentCount - 1) + '}')
    return result.join('\n')
  } else {
    return JSON.stringify(value)
  }
}

export class LayerInfo {
  loader: IContentLoader

  maa: boolean
  root: AbsolutePath
  parent?: LayerInfo

  type: 'interface' | 'resource'

  tasks: Record<TaskName, LayerTaskInfo[]>
  images: Set<ImageRelativePath>
  extraDecls: TaskDeclInfo[]
  extraRefs: TaskRefInfo[]

  dirty: boolean
  mergedDeclsCache: TaskDeclInfo[]
  mergedRefsCache: TaskRefInfo[]

  constructor(
    loader: IContentLoader,
    maa: boolean,
    root: AbsolutePath,
    type: 'interface' | 'resource'
  ) {
    this.loader = loader
    this.maa = maa
    this.root = root
    this.type = type

    this.tasks = {}
    this.images = new Set()
    this.extraDecls = []
    this.extraRefs = []

    this.dirty = true
    this.mergedDeclsCache = []
    this.mergedRefsCache = []
  }

  reset() {
    this.tasks = {}
    this.images = new Set()
    this.extraDecls = []
    this.extraRefs = []

    this.dirty = true
    this.mergedDeclsCache = []
    this.mergedRefsCache = []
  }

  mutableTaskInfo(name: TaskName) {
    this.tasks[name] = this.tasks[name] ?? []
    return this.tasks[name]
  }

  removeFile(file: AbsolutePath) {
    const changed: string[] = []
    for (const [task, infos] of Object.entries(this.tasks)) {
      const newInfos = infos.filter(info => info.file !== file)
      if (infos.length !== newInfos.length) {
        if (newInfos.length === 0) {
          delete this.tasks[task as TaskName]
        } else {
          infos.splice(0, infos.length, ...newInfos)
        }
        changed.push(task)
      }
    }
    this.extraDecls = this.extraDecls.filter(decl => decl.file !== file)
    this.extraRefs = this.extraRefs.filter(ref => ref.file !== file)
    this.markDirty()
    return changed
  }

  markDirty() {
    this.dirty = true
  }

  get mergedDecls() {
    this.flushMergedDeclsRefs()
    return this.mergedDeclsCache
  }

  get mergedRefs() {
    this.flushMergedDeclsRefs()
    return this.mergedRefsCache
  }

  get mergedAllDecls(): TaskDeclInfo[] {
    const upper = this.parent?.mergedAllDecls ?? []
    return upper.concat(this.mergedDecls)
  }

  get mergedAllRefs(): TaskRefInfo[] {
    const upper = this.parent?.mergedAllRefs ?? []
    return upper.concat(this.mergedRefs)
  }

  flushMergedDeclsRefs() {
    if (!this.dirty) {
      return
    }

    this.mergedDeclsCache = []
    this.mergedRefsCache = []
    for (const taskInfos of Object.values(this.tasks)) {
      for (const taskInfo of taskInfos) {
        this.mergedDeclsCache.push(...taskInfo.info.decls)
        this.mergedRefsCache.push(...taskInfo.info.refs)
      }
    }
    this.mergedDeclsCache.push(...this.extraDecls)
    this.mergedRefsCache.push(...this.extraRefs)
    this.dirty = false
  }

  getTaskListNotUnique(): TaskName[] {
    const tasks = this.parent?.getTaskList() ?? []
    return tasks.concat(Object.keys(this.tasks).filter(task => !task.startsWith('$')) as TaskName[])
  }

  getTaskList(): TaskName[] {
    return [...new Set(this.getTaskListNotUnique())]
  }

  getAnchorList(): [anchor: AnchorName, decl: TaskAnchorDeclInfo][] {
    const anchors = this.parent?.getAnchorList() ?? []
    const decls = this.mergedDecls.filter(decl => decl.type === 'task.anchor')
    anchors.push(
      ...decls.map(decl => [decl.anchor, decl] as [anchor: AnchorName, decl: TaskAnchorDeclInfo])
    )
    return anchors
  }

  getImageListNotUnique(): ImageRelativePath[] {
    const images = this.parent?.getImageList() ?? []
    return images.concat(...this.images)
  }

  getImageList(): ImageRelativePath[] {
    return [...new Set(this.getImageListNotUnique())]
  }

  maaFindTaskDecl(task: TaskName) {
    const tasks = this.getTaskList()
    let current = task
    while (!tasks.includes(current) && current.indexOf('@') !== -1) {
      current = current.replace(/^[^@]+@/, '') as TaskName
    }
    return current
  }

  getTask(task: TaskName, maaTrace = true): { layer: LayerInfo; infos: LayerTaskInfo[] }[] {
    const tasks = this.parent?.getTask(task) ?? []
    const infos = {
      layer: this,
      infos: [...(this.tasks[task] ?? [])]
    }
    tasks.unshift(infos)
    if (this.maa && maaTrace) {
      let current = task
      while (current.indexOf('@') !== -1) {
        const next = current.replace(/^[^@]+@/, '') as TaskName
        infos.infos.push(...(this.tasks[next] ?? []))
        current = next
      }
    }
    return tasks.filter(x => x.infos.length > 0)
  }

  evalTask(task: TaskName): Record<string, unknown> {
    const result = this.parent?.evalTask(task) ?? {}

    const info = this.tasks[task]?.[0]
    if (info) {
      const parts = info.info.parts

      const reco = ('$' + (parts.recoType?.value ?? 'DirectHit')) as TaskName
      const act = ('$' + (parts.actType?.value ?? 'DoNothing')) as TaskName

      Object.assign(result, this.tasks['$Default' as TaskName]?.[0].obj ?? {})
      Object.assign(result, this.tasks[reco]?.[0].obj ?? {})
      Object.assign(result, this.tasks[act]?.[0].obj ?? {})

      if (parts.recoType) {
        result['recognition'] = parts.recoType.value
      }
      if (parts.actType) {
        result['action'] = parts.actType.value
      }
      for (const [key, obj] of [...parts.base, ...parts.reco, ...parts.act, ...parts.unknown]) {
        result[key] = buildTree(obj)
      }
    }

    return result
  }

  getImage(
    image: ImageRelativePath
  ): [layer: LayerInfo, image: AbsolutePath, rel: ImageRelativePath][] {
    const layers = this.parent?.getImage(image) ?? []
    if (this.images.has(image)) {
      layers.unshift([this, joinImagePath(this.maa, this.root, image), image])
    }
    if (this.maa) {
      const suffix = '/' + image
      for (const file of this.images) {
        if (file.endsWith(suffix)) {
          layers.unshift([this, joinImagePath(this.maa, this.root, file), file])
        }
      }
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

  getTaskDoc(task: TaskName) {
    const docDecls = this.mergedAllDecls.filter(decl => decl.type === 'task.doc')

    return docDecls
      .filter(decl => decl.task === task)
      .map(decl => decl.doc)
      .join(' ')
  }

  toggleMode(mode: 1 | 2, info: LayerTaskInfo, indent = '    ') {
    const parts = info.info.parts
    const data: any = {}
    if (mode === 1) {
      if (parts.recoType) {
        data.recognition = parts.recoType.value
      }
      for (const [key, obj] of parts.reco) {
        data[key] = buildTree(obj)
      }
      if (parts.actType) {
        data.action = parts.actType.value
      }
      for (const [key, obj] of parts.act) {
        data[key] = buildTree(obj)
      }
    } else if (mode === 2) {
      if (parts.recoType || parts.reco.length > 0) {
        data.recognition = {}
        if (parts.recoType) {
          data.recognition.type = parts.recoType.value
        }
        if (parts.reco.length > 0) {
          data.recognition.param = {}
          for (const [key, obj] of parts.reco) {
            data.recognition.param[key] = buildTree(obj)
          }
        }
      }
      if (parts.actType || parts.act.length > 0) {
        data.action = {}
        if (parts.actType) {
          data.action.type = parts.actType.value
        }
        if (parts.act.length > 0) {
          data.action.param = {}
          for (const [key, obj] of parts.act) {
            data.action.param[key] = buildTree(obj)
          }
        }
      }
    }
    for (const [key, obj] of parts.base) {
      data[key] = buildTree(obj)
    }
    for (const [key, obj] of parts.unknown) {
      data[key] = buildTree(obj)
    }

    return JSON.stringify(info.prop.value) + ': ' + specialStringify(data, indent, 2)
  }
}
