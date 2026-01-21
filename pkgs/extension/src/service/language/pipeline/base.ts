import path from 'path'
import * as vscode from 'vscode'

import {
  AnchorName,
  ImageRelativePath,
  LayerInfo,
  TaskDeclInfo,
  TaskName,
  TaskRefInfo,
  extractTaskRef,
  joinImagePath
} from '@mse/pipeline-manager'

import { interfaceService, rootService } from '../..'
import { pipelineSuffix } from '../../../utils/fs'
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
      const filters: vscode.DocumentFilter[] = interfaceService.resourcePaths.map(path => ({
        scheme: 'file',
        pattern: new vscode.RelativePattern(
          vscode.Uri.joinPath(path, pipelineSuffix),
          '**/*.{json,jsonc}'
        )
      }))
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

  getTaskBrief(layer: LayerInfo, task: TaskName) {
    const info = layer.getTaskBriefInfo(task)
    return `Reco: ${info.reco ?? 'DirectHit'}\n\nAct: ${info.act ?? 'DoNothing'}`
  }

  async getTaskHover(layer: LayerInfo, task: TaskName) {
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
    return content.join('\n\n')
  }

  async getImageHover(layer: LayerInfo, image: ImageRelativePath) {
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
}
