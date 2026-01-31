import path from 'path'
import { json } from 'stream/consumers'
import * as vscode from 'vscode'

import {
  AbsolutePath,
  AnchorName,
  ImageRelativePath,
  InterfaceBundle,
  LayerInfo,
  TaskDeclInfo,
  TaskName,
  TaskRefInfo,
  extractTaskRef
} from '@mse/pipeline-manager'
import { Interface } from '@mse/types'
import { MaaTask } from '@nekosu/maa-tasker'

import { interfaceService, rootService } from '../..'
import { isMaaAssistantArknights, pipelineSuffix } from '../../../utils/fs'
import { BaseService } from '../../context'

export class PipelineLanguageProvider extends BaseService {
  provider?: vscode.Disposable

  constructor(setup: (selector: vscode.DocumentFilter[]) => vscode.Disposable) {
    super()

    this.defer = {
      dispose: () => {
        this.provider?.dispose()
      }
    }

    this.defer = interfaceService.onResourceChanged(() => {
      if (this.provider) {
        this.provider.dispose()
        this.provider = undefined
      }
      const filters: vscode.DocumentFilter[] = []
      for (const path of interfaceService.resourcePaths) {
        filters.push({
          scheme: 'file',
          pattern: new vscode.RelativePattern(
            vscode.Uri.joinPath(path, pipelineSuffix),
            '**/*.{json,jsonc}'
          )
        })
        filters.push({
          scheme: 'file',
          pattern: new vscode.RelativePattern(path, 'default_pipeline.json')
        })
      }
      const root = rootService.activeResource
      if (root) {
        filters.push({
          pattern: new vscode.RelativePattern(root.dirUri, path.basename(root.interfaceUri.fsPath))
        })
      }
      this.provider = setup(filters)
    })
  }

  shouldFilter(doc: vscode.TextDocument) {
    return interfaceService.shouldFilter(doc.uri)
  }

  async flush() {
    await interfaceService.interfaceBundle?.flush(true)
    return interfaceService.interfaceBundle ?? null
  }

  async flushIndex() {
    return (await this.flush())?.info ?? null
  }

  evalTask(
    intBundle: InterfaceBundle<Partial<Interface>>,
    task: TaskName,
    current?: TaskName
  ): Partial<Record<keyof maa.Task | keyof MaaTask, unknown>> | null {
    if (isMaaAssistantArknights) {
      const realTask = current ? `${current}@${task}` : task
      return intBundle.maaEvalTask(realTask)?.task ?? null
    } else {
      return intBundle.evalTask(task)
    }
  }

  getTaskRecoAct(
    intBundle: InterfaceBundle<Partial<Interface>>,
    task: TaskName,
    current?: TaskName
  ): [reco: string, act: string] {
    const final = this.evalTask(intBundle, task, current)
    if (isMaaAssistantArknights) {
      if (!final) {
        return ['Unknown', 'Unknown']
      } else {
        return [
          (final.algorithm as string) ?? 'MatchTemplate',
          (final.action as string) ?? 'DoNothing'
        ]
      }
    } else {
      if (!final) {
        return ['Unknown', 'Unknown']
      } else {
        return [
          (final.recognition as string) ?? 'DirectHit',
          (final.action as string) ?? 'DoNothing'
        ]
      }
    }
  }

  getTaskBrief(intBundle: InterfaceBundle<Partial<Interface>>, task: TaskName, current?: TaskName) {
    const [reco, act] = this.getTaskRecoAct(intBundle, task, current)
    if (isMaaAssistantArknights) {
      return `Algo: ${reco}\n\nAct: ${act}`
    } else {
      return `Reco: ${reco}\n\nAct: ${act}`
    }
  }

  async getTaskHover(
    intBundle: InterfaceBundle<Partial<Interface>>,
    layer: LayerInfo,
    task: TaskName,
    current?: TaskName
  ) {
    const taskInfos = layer.getTask(task)
    const content: string[] = []
    for (const { layer, infos } of taskInfos) {
      for (const info of infos) {
        const doc = await vscode.workspace.openTextDocument(info.file)
        const begin = doc.positionAt(info.prop.offset)
        const end = doc.positionAt(info.data.offset + info.data.length)
        const range = new vscode.Range(
          new vscode.Position(begin.line, 0),
          new vscode.Position(end.line + 1, 0)
        )
        content.push(`${rootService.relativeToRoot(layer.root)}

\`\`\`json
${doc.getText(range)}
\`\`\`
`)
      }
    }
    const final = this.evalTask(intBundle, task, current)
    if (final) {
      let showImage = false
      if (isMaaAssistantArknights) {
        const algo = (final?.algorithm as string) ?? 'MatchTemplate'
        showImage = ['MatchTemplate', 'FeatureMatch'].includes(algo)
      } else {
        const algo = (final?.recognition as string) ?? 'DirectHit'
        showImage = ['TemplateMatch', 'FeatureMatch'].includes(algo)
      }

      if (showImage) {
        let templates = final.template as string | string[] | undefined
        if (typeof templates === 'string') {
          templates = [templates]
        } else if (!templates && isMaaAssistantArknights) {
          const full = current ? (`${current}@${task}` as TaskName) : task
          templates = [intBundle.topLayer.maaFindTaskDecl(full) + '.png']
        }
        for (const templ of templates ?? []) {
          content.push(this.getImageHover(intBundle, layer, templ as ImageRelativePath))
        }
      }

      content.push(`
\`\`\`json
${JSON.stringify(final, null, 2)}
\`\`\`
`)
    }
    return content.join('\n\n')
  }

  getImageHover(
    intBundle: InterfaceBundle<Partial<Interface>>,
    layer: LayerInfo,
    image: ImageRelativePath
  ) {
    const layers = layer.getImage(image)
    const content: string[] = []
    for (const [layer, full, file] of layers) {
      content.push(`${rootService.relativeToRoot(layer.root)} - [${file}](${vscode.Uri.file(full).toString()})

![](${vscode.Uri.file(full).toString()})`)
    }
    return content.join('\n\n')
  }

  makeDecls(
    decls: TaskDeclInfo[],
    refs: TaskRefInfo[],
    decl: TaskDeclInfo | null,
    ref: TaskRefInfo | null
  ): TaskDeclInfo[] {
    if (decl) {
      if (decl.type === 'task.decl') {
        return decls.filter(d => d.type === 'task.decl' && d.task === decl.task)
      } else if (decl.type === 'task.anchor') {
        return decls.filter(d => d.type === 'task.anchor' && d.anchor === decl.anchor)
      } else if (decl.type === 'task.sub_reco') {
        return decls.filter(
          d => d.type === 'task.sub_reco' && d.name === decl.name && d.task === decl.task
        )
      }
    } else if (ref) {
      const task = extractTaskRef(ref)
      if (task) {
        return decls.filter(d => d.type === 'task.decl' && d.task === ref.target)
      } else if (ref.type === 'task.next' && ref.anchor) {
        return decls.filter(
          d => d.type === 'task.anchor' && d.anchor === (ref.target as string as AnchorName)
        )
      } else if (ref.type === 'task.roi') {
        return decls.filter(
          d => d.type === 'task.sub_reco' && d.name === ref.target && d.task === ref.task
        )
      }
    }
    return []
  }

  makeRefs(
    decls: TaskDeclInfo[],
    refs: TaskRefInfo[],
    decl: TaskDeclInfo | null,
    ref: TaskRefInfo | null
  ): TaskRefInfo[] {
    const findTask = (task: TaskName) => {
      return refs.filter(r => {
        if (r.type === 'task.target' || r.type === 'task.entry') {
          return r.target === task
        } else if (r.type === 'task.next') {
          return r.target === task && !r.anchor
        } else if (r.type === 'task.roi') {
          const prev = r.prev.filter(decl => decl.value === r.target)
          return prev.length === 0 && r.target === task
        } else {
          return false
        }
      })
    }

    if (decl) {
      if (decl.type === 'task.decl') {
        return findTask(decl.task)
      } else if (decl.type === 'task.anchor') {
        return refs.filter(
          r =>
            r.type === 'task.next' && r.anchor && (r.target as string as AnchorName) === decl.anchor
        )
      } else if (decl.type === 'task.sub_reco') {
        return refs.filter(
          r => r.type === 'task.roi' && r.target === decl.name && r.task === decl.task
        )
      }
    } else if (ref) {
      const task = extractTaskRef(ref)
      if (task) {
        return findTask(task)
      } else if (ref.type === 'task.next' && ref.anchor) {
        return refs.filter(r => r.type === 'task.next' && r.anchor && r.target === ref.target)
      } else if (ref.type === 'task.roi') {
        return refs.filter(
          r => r.type === 'task.roi' && r.target === ref.target && r.task === ref.task
        )
      }
    }
    return []
  }

  async makeMaaDecls(decls: TaskDeclInfo[], task: TaskName) {
    const result: [file: AbsolutePath, offset: number][] = []
    const prefix = task + '@'
    for (const decl of decls) {
      if (decl.type !== 'task.decl') {
        continue
      }
      for (const taskRef of decl.tasks) {
        if (taskRef.taskSuffix === task || taskRef.taskSuffix.startsWith(prefix)) {
          result.push([decl.file, decl.location.offset + 1 + taskRef.offset])
        }
      }
    }
    return await Promise.all(
      result.map(async ([file, offset]) => {
        const doc = await vscode.workspace.openTextDocument(file)
        return new vscode.Location(
          doc.uri,
          new vscode.Range(doc.positionAt(offset), doc.positionAt(offset + task.length))
        )
      })
    )
  }

  async makeMaaRefs(refs: TaskRefInfo[], task: TaskName) {
    const result: [file: AbsolutePath, offset: number][] = []
    const prefix = task + '@'
    for (const ref of refs) {
      if (ref.type !== 'task.maa.base_task' && ref.type !== 'task.maa.expr') {
        continue
      }
      for (const taskRef of ref.tasks) {
        if (taskRef.taskSuffix === task || taskRef.taskSuffix.startsWith(prefix)) {
          result.push([ref.file, ref.location.offset + 1 + taskRef.offset])
        }
      }
    }
    return await Promise.all(
      result.map(async ([file, offset]) => {
        const doc = await vscode.workspace.openTextDocument(file)
        return new vscode.Location(
          doc.uri,
          new vscode.Range(doc.positionAt(offset), doc.positionAt(offset + task.length))
        )
      })
    )
  }
}
