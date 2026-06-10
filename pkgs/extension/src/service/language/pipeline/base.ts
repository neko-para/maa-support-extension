import * as path from 'node:path'
import * as vscode from 'vscode'

import {
  type AnchorName,
  type ImageRelativePath,
  type TaskDeclInFile,
  type TaskName,
  type TaskRefInFile,
  extractTaskRef,
  isAnchorRef,
  nodePathUtils,
  normalizeImageFolder
} from '@nekosu/maa-pipeline-manager-vnext'
import { type FileView, type ResourceSnapshot, Snapshot } from '@nekosu/maa-pipeline-manager-vnext'
import type { MaaTask } from '@nekosu/maa-tasker'

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

    const updateProvider = () => {
      if (this.provider) {
        this.provider.dispose()
        this.provider = undefined
      }
      const filters: vscode.DocumentFilter[] = []
      for (const p of interfaceService.resourcePaths) {
        filters.push({
          scheme: 'file',
          pattern: new vscode.RelativePattern(
            vscode.Uri.joinPath(p, pipelineSuffix),
            '**/*.{json,jsonc}'
          )
        })
        filters.push({
          scheme: 'file',
          pattern: new vscode.RelativePattern(p, 'default_pipeline.json')
        })
      }
      const root = rootService.activeResource
      if (root) {
        filters.push({
          pattern: new vscode.RelativePattern(root.dirUri, path.basename(root.interfaceUri.fsPath))
        })
        for (const imp of interfaceService.interfaceBundle?.importFiles ?? []) {
          filters.push({
            scheme: 'file',
            pattern: new vscode.RelativePattern(root.dirUri, imp)
          })
        }
        const snapshot = interfaceService.getSnapshot()
        for (const lang of snapshot?.languages ?? []) {
          filters.push({
            scheme: 'file',
            pattern: new vscode.RelativePattern(root.dirUri, lang.file)
          })
        }
      }
      this.provider = setup(filters)
    }

    this.defer = interfaceService.onResourceChanged(updateProvider)
    this.defer = interfaceService.onInterfaceImportChanged(updateProvider)
  }

  shouldFilter(doc: vscode.TextDocument) {
    return interfaceService.shouldFilter(doc.uri)
  }

  async flush(): Promise<ResourceSnapshot | null> {
    return interfaceService.getSnapshot()
  }

  async flushIndex(): Promise<ResourceSnapshot | null> {
    return this.flush()
  }

  // TODO(Phase8): maaEvalTask — MAA 项目 eval 需要集成 @nekosu/maa-tasker
  evalTask(
    snapshot: ResourceSnapshot,
    task: TaskName,
    _current?: TaskName
  ): Partial<Record<keyof maa.Task | keyof MaaTask, unknown>> | null {
    if (isMaaAssistantArknights) {
      return null
    }
    const resolved = Snapshot.resolveTask(snapshot, task)
    return (resolved as Partial<Record<keyof maa.Task | keyof MaaTask, unknown>>) ?? null
  }

  getTaskRecoAct(
    snapshot: ResourceSnapshot,
    task: TaskName,
    current?: TaskName
  ): [reco: string, act: string] {
    const final = this.evalTask(snapshot, task, current)
    if (isMaaAssistantArknights) {
      if (!final) {
        return ['Unknown', 'Unknown']
      }
      return [
        (final.algorithm as string) ?? 'MatchTemplate',
        (final.action as string) ?? 'DoNothing'
      ]
    }
    if (!final) {
      return ['Unknown', 'Unknown']
    }
    return [(final.recognition as string) ?? 'DirectHit', (final.action as string) ?? 'DoNothing']
  }

  getTaskBrief(snapshot: ResourceSnapshot, task: TaskName, current?: TaskName) {
    const [reco, act] = this.getTaskRecoAct(snapshot, task, current)
    if (isMaaAssistantArknights) {
      return `Algo: ${reco}\n\nAct: ${act}`
    }
    const doc = Snapshot.getTaskDoc(snapshot, task)
    return `${doc}\n\nReco: ${reco}\n\nAct: ${act}`
  }

  async getTaskHover(
    snapshot: ResourceSnapshot,
    file: FileView,
    task: TaskName,
    current?: TaskName
  ) {
    if (task.length === 0) {
      return ''
    }
    const taskInfos = Snapshot.getTask(snapshot, task)
    const content: string[] = []
    for (const { bundle, info } of taskInfos) {
      // TODO: 这里完全就不应该findDecl. 之前是迭代了所有Bundle中每个Bundle的任务, 现在每个Bundle只有一个了(来自getTask中findTask的逻辑)
      const taskDecl = info.decls.find(d => d.type === 'task.decl')
      if (taskDecl) {
        const doc = await vscode.workspace.openTextDocument(taskDecl.file)
        const begin = doc.positionAt(info.prop.offset)
        const end = doc.positionAt(info.data.offset + info.data.length)
        const range = new vscode.Range(
          new vscode.Position(begin.line, 0),
          new vscode.Position(end.line + 1, 0)
        )
        content.push(`${rootService.relativeToRoot(bundle.root)}

\`\`\`json
${doc.getText(range)}
\`\`\`
`)
      }
    }
    const final = this.evalTask(snapshot, task, current)
    if (final) {
      let showImage: boolean
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
          // TODO(Phase8): maaFindTaskDecl — MAA 项目模板路径解析
          templates = []
        }
        for (const templ of templates ?? []) {
          content.push(this.getImageHover(snapshot, file, templ as ImageRelativePath))
        }
      }

      content.push(`merged

\`\`\`json
${JSON.stringify(final, null, 2)}
\`\`\`
`)
    }
    return content.join('\n\n')
  }

  getImageHover(snapshot: ResourceSnapshot, _file: FileView, image: ImageRelativePath) {
    const content: string[] = []
    if (!snapshot.bundles[0]?.maa && !image.endsWith('.png')) {
      const imageFolders = Snapshot.getImageFolders(snapshot)
      const norm = normalizeImageFolder(nodePathUtils, image)
      const bundles = imageFolders.get(norm)
      if (bundles) {
        for (const b of bundles) {
          const matching = [...b.images].filter(img => img.startsWith(norm + '/'))
          content.push(`${rootService.relativeToRoot(b.root)} - ${matching.length} images
`)
        }
      }
    } else {
      const layers = Snapshot.getImage(snapshot, nodePathUtils, image)
      for (const { bundle, absPath, rel } of layers) {
        content.push(`${rootService.relativeToRoot(bundle.root)} - [${rel}](${vscode.Uri.file(absPath).toString()})

![](${vscode.Uri.file(absPath).toString()})`)
      }
    }
    return content.join('\n\n')
  }

  async getLocaleHover(target: string) {
    const snapshot = interfaceService.getSnapshot()
    if (!snapshot) {
      return null
    }

    if (snapshot.languages.length === 0) {
      return null
    }

    const result = Snapshot.queryLocale(snapshot, target)

    const content: string[] = []
    for (const [index, lang] of snapshot.languages.entries()) {
      const entry = result[index]
      if (entry) {
        const doc = await vscode.workspace.openTextDocument(lang.file)
        const pos = doc.positionAt(entry.keyOffset)
        content.push(
          `| [${lang.name}](${vscode.Uri.file(lang.file)}#L${pos.line + 1}) | ${entry.value.replaceAll('\n', '<br>')} |`
        )
      } else {
        content.push(`| ${lang.name} | <missing> |`)
      }
    }

    if (content.length > 0) {
      return `| locale | value |\n| --- | --- |\n${content.join('\n')}`
    }
    return null
  }

  makeDecls(
    decls: TaskDeclInFile[],
    _refs: TaskRefInFile[],
    decl: TaskDeclInFile | null,
    ref: TaskRefInFile | null
  ): TaskDeclInFile[] {
    if (decl) {
      if (decl.type === 'task.decl') {
        return decls.filter(d => d.type === 'task.decl' && d.task === decl.task)
      } else if (decl.type === 'task.anchor') {
        return decls.filter(d => d.type === 'task.anchor' && d.anchor === decl.anchor)
      } else if (decl.type === 'task.sub_reco') {
        return decls.filter(
          d => d.type === 'task.sub_reco' && d.name === decl.name && d.task === decl.task
        )
      } else if (decl.type === 'task.locale') {
        return decls.filter(d => d.type === 'task.locale' && d.key === decl.key)
      }
    } else if (ref) {
      const task = extractTaskRef(ref)
      if (task && 'target' in ref) {
        return decls.filter(d => d.type === 'task.decl' && d.task === ref.target)
      } else if (isAnchorRef(ref)) {
        return decls.filter(
          d =>
            d.type === 'task.anchor' &&
            d.anchor === ((ref as { target: string }).target as AnchorName)
        )
      } else if (ref.type === 'task.roi') {
        return decls.filter(
          d => d.type === 'task.sub_reco' && d.name === ref.target && d.task === ref.task
        )
      } else if (ref.type === 'task.locale') {
        return decls.filter(d => d.type === 'task.locale' && d.key === ref.target)
      }
    }
    return []
  }

  makeRefs(
    _decls: TaskDeclInFile[],
    refs: TaskRefInFile[],
    decl: TaskDeclInFile | null,
    ref: TaskRefInFile | null
  ): TaskRefInFile[] {
    const findTask = (task: TaskName) => {
      return refs.filter(r => {
        if (
          r.type === 'task.anchor' ||
          r.type === 'task.reco' ||
          r.type === 'task.color_filter' ||
          r.type === 'task.custom_task' ||
          r.type === 'task.entry'
        ) {
          return r.target === task
        } else if (r.type === 'task.next' || r.type === 'task.target') {
          return r.target === task && !r.attrs.attrs.Anchor
        } else if (r.type === 'task.roi' && !r.attrs.attrs.Anchor) {
          const prev = r.prev.filter(d => d.value === r.target)
          return prev.length === 0 && r.target === task
        }
        return false
      })
    }

    if (decl) {
      if (decl.type === 'task.decl') {
        return findTask(decl.task)
      } else if (decl.type === 'task.anchor') {
        return refs.filter(r => {
          if (!isAnchorRef(r)) {
            return false
          }
          return ((r as { target: string }).target as AnchorName) === decl.anchor
        })
      } else if (decl.type === 'task.sub_reco') {
        return refs.filter(
          r => r.type === 'task.roi' && r.target === decl.name && r.task === decl.task
        )
      } else if (decl.type === 'task.locale') {
        return refs.filter(r => r.type === 'task.locale' && r.target === decl.key)
      }
    } else if (ref) {
      const task = extractTaskRef(ref)
      if (task) {
        return findTask(task)
      } else if (isAnchorRef(ref)) {
        return refs.filter(r => {
          if (!isAnchorRef(r)) {
            return false
          }
          return (r as { target: string }).target === (ref as { target: string }).target
        })
      } else if (ref.type === 'task.roi') {
        return refs.filter(
          r => r.type === 'task.roi' && r.target === ref.target && r.task === ref.task
        )
      } else if (ref.type === 'task.locale') {
        return refs.filter(r => r.type === 'task.locale' && r.target === ref.target)
      }
    }
    return []
  }

  // TODO(Phase8): makeMaaDecls/makeMaaRefs — MAA 项目任务名 @ 分隔符解析
  async makeMaaDecls(_decls: TaskDeclInFile[], _task: TaskName) {
    return []
  }

  async makeMaaRefs(_refs: TaskRefInFile[], _task: TaskName) {
    return []
  }
}
