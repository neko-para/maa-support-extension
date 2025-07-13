import { existsSync } from 'fs'
import path from 'path'
import * as vscode from 'vscode'

import { t } from '@mse/utils'

import { interfaceService, rootService } from '.'
import { imageSuffix, isMaaAssistantArknights } from '../utils/fs'
import { BaseService } from './context'
import { InterfaceLayer } from './layer/interface'
import { TaskLayer } from './layer/task'
import { PipelineLayer, TaskIndexInfo, TaskQueryResult } from './types'

export class TaskIndexService extends BaseService {
  interfaceLayer?: InterfaceLayer
  layers: TaskLayer[] = []

  constructor() {
    super()
    console.log('construct TaskService')

    this.defer = {
      dispose: () => {
        this.interfaceLayer?.dispose()
        this.layers.forEach(layer => layer.dispose())
      }
    }

    rootService.onActiveResourceChanged(() => {
      this.interfaceLayer?.dispose()
      if (rootService.activeResource) {
        this.interfaceLayer = new InterfaceLayer(
          rootService.activeResource.interfaceUri,
          this.layers.length
        )
      }
    })

    interfaceService.onResourceChanged(async () => {
      this.layers.forEach(layer => layer.dispose())
      this.layers = interfaceService.resourcePaths.map((uri, index) => new TaskLayer(uri, index))
      if (this.interfaceLayer) {
        this.interfaceLayer.level = this.layers.length
      }
      for (const layer of this.layers) {
        await layer.init()
      }
    })
  }

  async init() {
    console.log('init TaskService')
  }

  async flushDirty() {
    return Promise.all(this.allLayers.map(layer => layer.flushDirty()))
  }

  async flushImage() {
    return Promise.all(this.allLayers.map(layer => layer.flushImage()))
  }

  get allLayers(): PipelineLayer[] {
    return this.interfaceLayer ? [...this.layers, this.interfaceLayer] : this.layers
  }

  getLayer(uri: vscode.Uri): PipelineLayer | null {
    for (const layer of this.layers) {
      if (uri.fsPath.startsWith(layer.uri.fsPath + path.sep)) {
        return layer
      }
    }
    if (uri.fsPath === this.interfaceLayer?.uri.fsPath) {
      return this.interfaceLayer
    }
    return null
  }

  async queryLocation(
    uri: vscode.Uri,
    pos: vscode.Position
  ): Promise<[TaskQueryResult, PipelineLayer] | [null, null]> {
    await this.flushDirty()
    const layer = this.getLayer(uri)
    if (!layer) {
      return [null, null]
    }
    for (const [task, infos] of Object.entries(layer.index)) {
      for (const info of infos) {
        if (info.uri.fsPath !== uri.fsPath) {
          continue
        }
        if (info.taskProp.contains(pos)) {
          return [
            {
              type: 'task.prop',
              task: task,
              range: info.taskProp,
              target: task
            },
            layer
          ]
        } else if (info.taskBody.contains(pos)) {
          for (const ref of info.taskRef) {
            if (ref.range.contains(pos)) {
              if (ref.fake) {
                switch (ref.fake) {
                  case 'maa.#':
                    return [
                      {
                        type: 'task.ref.maa.#',
                        task: task,
                        range: ref.range,
                        target: ref.task
                      },
                      layer
                    ]
                  case 'maa.@':
                    return [
                      {
                        type: 'task.ref.maa.@',
                        task: task,
                        range: ref.range,
                        target: ref.task
                      },
                      layer
                    ]
                }
              } else {
                return [
                  {
                    type: 'task.ref',
                    task: task,
                    range: ref.range,
                    target: ref.task
                  },
                  layer
                ]
              }
            }
          }
          for (const ref of info.imageRef) {
            if (ref.range.contains(pos)) {
              return [
                {
                  type: 'image.ref',
                  task: task,
                  range: ref.range,
                  target: ref.path
                },
                layer
              ]
            }
          }
          return [
            {
              type: 'task.body',
              task: task,
              range: info.taskBody
            },
            layer
          ]
        }
      }
    }
    return [null, null]
  }

  async queryTask(task: string, level?: number, pos?: vscode.Position, flush = true) {
    if (flush) {
      await this.flushDirty()
    }

    const allLayers = this.allLayers
    if (level === undefined) {
      level = allLayers.length
    }
    const result: {
      uri: vscode.Uri
      info: TaskIndexInfo
    }[] = []

    const search = (task: string) => {
      for (const layer of allLayers.slice(0, level)) {
        for (const info of layer.index[task] ?? []) {
          if (layer.index[task].length > 1 && pos && !info.taskProp.contains(pos)) {
            continue
          }
          result.push({
            uri: layer.uri,
            info: info
          })
        }
      }
    }
    search(task)
    if (isMaaAssistantArknights) {
      while (/@/.test(task)) {
        task = task.replace(/^[^@]*@/, '')
        search(task)
      }
    }
    return result
  }

  async queryImage(image: string, level?: number, flush = true) {
    if (isMaaAssistantArknights) {
      if (!image.endsWith('.png')) {
        image = image + '.png'
      }
    }

    if (flush) {
      await this.flushDirty()
    }

    const allLayers = this.allLayers
    if (level === undefined) {
      level = allLayers.length
    }
    const result: {
      uri: vscode.Uri
      info: {
        uri: vscode.Uri
        rel: string
        allUris: vscode.Uri[] // MAA
      }
    }[] = []
    for (const layer of allLayers.slice(0, level)) {
      if (isMaaAssistantArknights) {
        // MAA可以允许省略前置路径
        const allUris = layer.images.filter(({ relative }) => {
          if (relative === image || relative.endsWith(path.sep + image)) {
            return true
          }
          return false
        })
        if (allUris.length > 0) {
          result.push({
            uri: layer.uri,
            info: {
              uri: allUris[0].uri,
              rel: allUris[0].relative,
              allUris: allUris.map(x => x.uri)
            }
          })
        }
      } else {
        const iu = vscode.Uri.joinPath(layer.uri, imageSuffix, image)
        if (existsSync(iu.fsPath)) {
          result.push({
            uri: layer.uri,
            info: {
              uri: iu,
              rel: image,
              allUris: [iu]
            }
          })
        }
      }
    }
    return result
  }

  async queryTaskList(level?: number) {
    await this.flushDirty()
    if (level === undefined) {
      level = this.layers.length
    }
    const result: string[] = []
    for (const layer of this.layers.slice(0, level)) {
      result.push(...Object.keys(layer.index))
    }
    return [...new Set<string>(result)]
  }

  async queryImageList(level?: number) {
    await this.flushDirty()
    if (level === undefined) {
      level = this.layers.length
    }
    const result: string[] = []
    for (const layer of this.layers.slice(0, level)) {
      const pattern = new vscode.RelativePattern(layer.uri, imageSuffix + '/**/*.png')
      const files = await vscode.workspace.findFiles(pattern)
      result.push(
        ...files.map(uri =>
          rootService
            .relativePathToRoot(uri, imageSuffix, layer.uri)
            .replace(/^[\\/]/, '')
            .replaceAll(/[\\/]/g, '/')
        )
      )
    }
    return [...new Set<string>(result)]
  }

  async queryTaskDoc(
    task: string,
    level?: number,
    pos?: vscode.Position
  ): Promise<vscode.MarkdownString> {
    const result = await this.queryTask(task, level, pos)
    if (result.length > 0) {
      return new vscode.MarkdownString(
        result
          .map(
            x =>
              `${rootService.relativePathToRoot(x.uri)}\n\n\`\`\`json\n${x.info.taskReferContent}\n\`\`\``
          )
          .join('\n\n')
      )
    } else {
      return new vscode.MarkdownString(t('maa.pipeline.error.unknown-task', task))
    }
  }

  queryImageDoc(image: string, level?: number, nullable?: false): Promise<vscode.MarkdownString>
  queryImageDoc(image: string, level: number, nullable: true): Promise<vscode.MarkdownString | null>
  async queryImageDoc(
    image: string,
    level?: number,
    nullable = false
  ): Promise<vscode.MarkdownString | null> {
    const allLayers = this.allLayers
    if (level === undefined) {
      level = allLayers.length
    }
    if (isMaaAssistantArknights) {
      for (const layer of allLayers.slice(0, level)) {
        await layer.flushImage()
      }
    }

    const result = await this.queryImage(image, level)
    if (result.length > 0) {
      return new vscode.MarkdownString(
        result
          .map(
            x => `${rootService.relativePathToRoot(x.uri)} - ${x.info.rel}\n\n![](${x.info.uri})`
          )
          .join('\n\n')
      )
    } else {
      return nullable
        ? null
        : new vscode.MarkdownString(t('maa.pipeline.error.unknown-image', image))
    }
  }
}
