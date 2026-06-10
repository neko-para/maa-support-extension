import { type Node, parseTree } from 'jsonc-parser'

import { mergeInterfaces } from '../interface/merge'
import { parseInterface } from '../interface/parser'
import type {
  InterfaceDeclInFile,
  InterfaceFileView,
  InterfaceParseResult,
  InterfaceRefInFile,
  ParsedInterface,
  RawInterfaceParseResult
} from '../interface/types'
import type { IContentLoader } from '../io/types'
import type { IPathUtils } from '../path/interface'
import { extname } from '../path/utils'
import { parseArray, parseObject } from '../utils/parse'
import { parsePipelineFile, parseTaskNode } from '../pipeline/fw'
import type { ParserConfig, TaskInfoInFile } from '../pipeline/types'
import { createBundleView, createSnapshot } from '../snapshot'
import type { BundleView, DefaultConfig } from '../snapshot/bundle-view'
import type { FileView } from '../snapshot/file-view'
import type { LanguageInfo, LocaleEntry, ResourceSnapshot } from '../snapshot/snapshot'
import type { AbsolutePath, ImageRelativePath, RelativePath, TaskName } from '../types'

const PIPELINE_EXTENSIONS = new Set(['.json', '.jsonc'])
const IMAGE_EXTENSIONS = new Set(['.png'])

/** 将 parser 原始输出标注为带文件的解析结果 */
function annotateInterfaceParseResult(
  raw: RawInterfaceParseResult,
  file: AbsolutePath
): InterfaceParseResult {
  return {
    data: raw.data,
    decls: raw.decls.map(d => ({ ...d, file }) as InterfaceDeclInFile),
    refs: raw.refs.map(r => ({ ...r, file }) as InterfaceRefInFile)
  }
}

/** 从 interface JSON AST 中提取所有 pipeline_override 条目 */
function extractOverrideEntries(
  node: Node
): { taskName: TaskName; taskNode: Node; propNode: Node }[] {
  const result: { taskName: TaskName; taskNode: Node; propNode: Node }[] = []
  extractOverrideEntriesRecur(node, result)
  return result
}

function extractOverrideEntriesRecur(
  node: Node,
  out: { taskName: TaskName; taskNode: Node; propNode: Node }[]
) {
  if (node.type === 'object') {
    for (const [key, val] of parseObject(node)) {
      if (key === 'pipeline_override' && val.type === 'object') {
        for (const [taskKey, taskVal, propNode] of parseObject(val)) {
          if (!taskKey.startsWith('$')) {
            out.push({
              taskName: taskKey as TaskName,
              taskNode: taskVal,
              propNode
            })
          }
        }
      } else {
        extractOverrideEntriesRecur(val, out)
      }
    }
  } else if (node.type === 'array') {
    for (const item of parseArray(node)) {
      extractOverrideEntriesRecur(item, out)
    }
  }
}

export class Project {
  readonly loader: IContentLoader
  readonly pathUtils: IPathUtils
  readonly maa: boolean
  readonly parser: ParserConfig | undefined

  /** 项目根目录（interface.json 所在目录）——始终为绝对路径 */
  readonly root: AbsolutePath

  private _bundles: readonly BundleView[] = []
  private _languages: readonly LanguageInfo[] = []
  private _interfaceData: ParsedInterface | null = null
  private _interfaceFiles: readonly InterfaceFileView[] = []
  private _interfaceBundle: BundleView | null = null
  private _snapshot: ResourceSnapshot | null = null
  private _activeController: string | null = null
  private _activeResource: string | null = null

  /** 合并后的 interface 数据（controller/resource/task/option... Records 已合并 import） */
  get interfaceData(): ParsedInterface | null {
    return this._interfaceData
  }

  /** 合并后的 interface（含 decls/refs——惰性拼接自各文件，保持向后兼容） */
  get parsedInterface(): InterfaceParseResult | null {
    if (!this._interfaceData) return null
    return {
      data: this._interfaceData,
      decls: this._interfaceFiles.flatMap(f => f.decls),
      refs: this._interfaceFiles.flatMap(f => f.refs)
    }
  }

  /** 当前快照 */
  get snapshot(): ResourceSnapshot | null {
    return this._snapshot
  }

  /** 当前激活的 controller */
  get activeController(): string | null {
    return this._activeController
  }

  /** 当前激活的 resource */
  get activeResource(): string | null {
    return this._activeResource
  }

  constructor(
    loader: IContentLoader,
    pathUtils: IPathUtils,
    maa: boolean,
    root: string,
    parser?: ParserConfig
  ) {
    this.loader = loader
    this.pathUtils = pathUtils
    this.maa = maa
    this.root = root as AbsolutePath
    this.parser = parser
  }

  /** 加载并解析 interface.json，包括 import 文件的合并 */
  async loadInterface(filename = 'interface.json'): Promise<void> {
    const filePath = this.pathUtils.join(this.root, filename)
    const content = await this.loader.get(filePath)
    if (!content) {
      throw new Error(`Cannot read interface file: ${filePath}`)
    }

    const rawBase = parseInterface(content)
    this._interfaceBundle = this._buildInterfaceBundle(content)
    if (!rawBase) {
      throw new Error(`Failed to parse interface file: ${filePath}`)
    }
    const base = annotateInterfaceParseResult(rawBase, filePath)

    const imports = base.data.import ?? []
    const importResults: InterfaceParseResult[] = []
    const importPaths: AbsolutePath[] = []
    for (const imp of imports) {
      const impPath = this.pathUtils.join(this.root, imp as string)
      const impContent = await this.loader.get(impPath)
      if (impContent) {
        const rawImp = parseInterface(impContent)
        if (rawImp) {
          importResults.push(annotateInterfaceParseResult(rawImp, impPath))
          importPaths.push(impPath)
        }
      }
    }

    // data 即时合并（业务层使用），decls/refs 保持按文件隔离（诊断层惰性合并）
    this._interfaceData =
      importResults.length > 0 ? mergeInterfaces(base, ...importResults).data : base.data
    this._interfaceFiles = [
      { path: filePath, decls: base.decls, refs: base.refs },
      ...importResults.map((r, i) => ({
        path: importPaths[i],
        decls: r.decls,
        refs: r.refs
      }))
    ]

    await this._loadLanguages()
  }

  private async _loadLanguages(): Promise<void> {
    const iface = this._interfaceData
    if (!iface) {
      this._languages = []
      return
    }

    const langMap = iface.languages
    if (!langMap) {
      this._languages = []
      return
    }

    const langs: LanguageInfo[] = []
    for (const [name, relPath] of Object.entries(langMap)) {
      if (!relPath) {
        continue
      }
      const absPath = this.pathUtils.join(this.root, relPath as string)
      const content = await this.loader.get(absPath)
      if (!content) {
        continue
      }
      try {
        const tree = parseTree(content)
        const entries = new Map<string, LocaleEntry>()
        if (tree && tree.type === 'object') {
          for (const prop of tree.children ?? []) {
            if (prop.type === 'property' && prop.children?.length === 2) {
              const [keyNode, valueNode] = prop.children
              if (keyNode.type === 'string') {
                entries.set(keyNode.value as string, {
                  value: String(valueNode.value ?? ''),
                  keyOffset: keyNode.offset
                })
              }
            }
          }
        }
        langs.push(Object.freeze({ name, file: absPath, entries }))
      } catch {
        // 语言文件解析失败时跳过，不影响其他文件加载
      }
    }
    this._languages = langs
  }

  /** 加载一个资源目录为 BundleView */
  async loadBundle(bundlePath: AbsolutePath): Promise<BundleView> {
    const pipelineDir = this._pipelineDir
    const imageDir = this._imageDir
    const pipelineRoot = this.pathUtils.join(bundlePath, pipelineDir)
    const imageRoot = this.pathUtils.join(bundlePath, imageDir)

    const allPipelineFiles = await this.loader.listFiles(pipelineRoot)
    const jsonFiles = allPipelineFiles.filter(f => PIPELINE_EXTENSIONS.has(extname(f)))

    const files = new Map<RelativePath, FileView>()
    for (const rel of jsonFiles) {
      const absPath = this.pathUtils.join(pipelineRoot, rel)
      const parsed = await this._loadPipelineFile(absPath)
      if (parsed) {
        files.set(rel as RelativePath, parsed)
      }
    }

    const defaultPath = this.pathUtils.join(bundlePath, 'default_pipeline.json')
    const defaultContent = await this.loader.get(defaultPath)
    let defaultConfig: DefaultConfig | null = null
    if (defaultContent !== null) {
      // 作为 DefaultConfig（供 resolveTask 属性继承）
      defaultConfig = this._makeDefaultConfig(
        defaultPath,
        parsePipelineFile(defaultContent, { maa: this.maa, isDefault: true, parser: this.parser })
      )
      // 同时作为 FileView（isDefault: true），让 LSP 和 locateBundle 能找到
      files.set(
        'default_pipeline.json' as RelativePath,
        this._makeFileView(
          defaultPath,
          parsePipelineFile(defaultContent, { maa: this.maa, parser: this.parser }),
          true
        )
      )
    }

    const allImageFiles = await this.loader.listFiles(imageRoot)
    const images = new Set<ImageRelativePath>(
      allImageFiles.filter(f => IMAGE_EXTENSIONS.has(extname(f))) as ImageRelativePath[]
    )

    return createBundleView({
      root: bundlePath,
      files,
      images,
      defaultConfig
    })
  }

  /** 根据当前 active resource 加载所有 Bundle 并重建快照 */
  async loadBundles(): Promise<void> {
    if (!this._interfaceData) {
      throw new Error('Interface not loaded. Call loadInterface() first.')
    }

    const resName = this._activeResource
    if (!resName) {
      this._bundles = []
      this._buildSnapshot()
      return
    }

    const resInfo = this._interfaceData.resource[resName]
    if (!resInfo) {
      this._bundles = []
      this._buildSnapshot()
      return
    }

    const paths =
      typeof resInfo.path === 'string' ? [resInfo.path as string] : (resInfo.path as string[])

    const bundles: BundleView[] = []
    for (const p of paths) {
      const absPath = this.pathUtils.join(this.root, p)
      const bundle = await this.loadBundle(absPath)
      bundles.push(bundle)
    }

    if (this._interfaceBundle) {
      bundles.push(this._interfaceBundle)
    }

    this._bundles = bundles
    this._buildSnapshot()
  }

  /** 从 interface JSON 的 pipeline_override 构建 interface BundleView */
  private _buildInterfaceBundle(content: string): BundleView | null {
    const tree = parseTree(content)
    if (!tree) {
      return null
    }
    const entries = extractOverrideEntries(tree)
    if (entries.length === 0) {
      return null
    }

    const root = (this.root + '/interface') as AbsolutePath
    const tasks = new Map<TaskName, TaskInfoInFile[]>()
    for (const { taskName, taskNode, propNode } of entries) {
      const parsed = parseTaskNode(taskNode, {
        taskName,
        taskKey: propNode,
        parser: this.parser
      })
      const annotated: TaskInfoInFile = {
        parts: parsed.parts,
        decls: parsed.decls.map(d => ({ ...d, file: root })),
        refs: parsed.refs.map(r => ({ ...r, file: root }))
      }
      const existing = tasks.get(taskName)
      if (existing) {
        existing.push(annotated)
      } else {
        tasks.set(taskName, [annotated])
      }
    }

    const fv: FileView = Object.freeze({
      path: root,
      tasks,
      fileDecls: [],
      isDefault: false
    })

    return createBundleView({
      root,
      files: new Map([['__pipeline_override.json' as RelativePath, fv]]),
      images: new Set(),
      isInterface: true
    })
  }

  /** 根据绝对路径查找所属 Bundle 的索引，-1 表示不属于任何 Bundle */
  findBundleIndex(absPath: AbsolutePath): number {
    for (let i = 0; i < this._bundles.length; i++) {
      const rel = this.pathUtils.relative(this._bundles[i].root, absPath)
      if (!rel.startsWith('..') && rel !== '') {
        return i
      }
    }
    return -1
  }

  /**
   * 处理单个文件变更——根据路径和类型路由到粒度更新方法。
   * interface / import 文件变更会触发全量重载；
   * pipeline / 图像文件变更仅重建所属 Bundle。
   */
  async handleFileChange(
    absPath: AbsolutePath,
    action: 'added' | 'changed' | 'deleted'
  ): Promise<void> {
    const rel = this.pathUtils.relative(this.root, absPath)

    if (rel === 'interface.json' || this._isImportFile(rel)) {
      await this.reload()
      return
    }

    const idx = this.findBundleIndex(absPath)
    if (idx < 0) {
      return
    }

    const bundle = this._bundles[idx]
    const bundleRel = this.pathUtils.relative(bundle.root, absPath)
    const pipelineDir = this._pipelineDir
    const imageDir = this._imageDir

    if (bundleRel === 'default_pipeline.json') {
      await this._reloadDefaultConfig(idx)
      return
    }

    if (bundleRel.startsWith(pipelineDir + this.pathUtils.sep)) {
      const relPath = bundleRel.slice(pipelineDir.length + 1) as RelativePath
      if (action === 'deleted') {
        this._removePipelineFile(idx, relPath)
      } else {
        await this._reloadPipelineFile(idx, relPath)
      }
      return
    }

    if (bundleRel.startsWith(imageDir + this.pathUtils.sep)) {
      const imageRel = bundleRel.slice(imageDir.length + 1)
      if (IMAGE_EXTENSIONS.has(extname(imageRel))) {
        this._updateBundleImage(idx, imageRel, action !== 'deleted')
      }
    }
  }

  /** 获取当前快照 */
  getSnapshot(): ResourceSnapshot | null {
    return this._snapshot
  }

  /** 切换 active controller / resource 并重建快照 */
  async switchActive(controller: string, resource: string): Promise<void> {
    this._activeController = controller
    this._activeResource = resource
    await this.loadBundles()
  }

  /** 从文件系统重新读取所有文件并重建快照 */
  async reload(): Promise<void> {
    await this.loadInterface()
    if (this._interfaceData) {
      await this.loadBundles()
    }
  }

  private _buildSnapshot(): void {
    this._snapshot = createSnapshot({
      bundles: this._bundles,
      interfaceData: this._interfaceData,
      interfaceFiles: this._interfaceFiles,
      interfaceFile: this.pathUtils.join(this.root, 'interface.json'),
      languages: this._languages
    })
  }

  private get _pipelineDir(): string {
    return this.maa ? 'tasks' : 'pipeline'
  }

  private get _imageDir(): string {
    return this.maa ? 'template' : 'image'
  }

  private _makeFileView(
    absPath: AbsolutePath,
    parsed: ReturnType<typeof parsePipelineFile>,
    isDefault = false
  ): FileView {
    const tasks = new Map<TaskName, TaskInfoInFile[]>()
    for (const [name, info] of parsed.tasks) {
      tasks.set(name, [
        {
          parts: info.parts,
          decls: info.decls.map(d => ({ ...d, file: absPath })),
          refs: info.refs.map(r => ({ ...r, file: absPath }))
        }
      ])
    }
    return Object.freeze({
      path: absPath,
      tasks,
      fileDecls: parsed.fileDecls.map(d => ({ ...d, file: absPath })),
      isDefault
    } satisfies FileView)
  }

  private _makeDefaultConfig(
    absPath: AbsolutePath,
    parsed: ReturnType<typeof parsePipelineFile>
  ): DefaultConfig {
    const annotated = new Map<TaskName, TaskInfoInFile>()
    for (const [name, info] of parsed.tasks) {
      annotated.set(name, {
        parts: info.parts,
        decls: info.decls.map(d => ({ ...d, file: absPath })),
        refs: info.refs.map(r => ({ ...r, file: absPath }))
      })
    }
    return annotated
  }

  private async _loadPipelineFile(absPath: AbsolutePath): Promise<FileView | null> {
    const content = await this.loader.get(absPath)
    if (content === null) {
      return null
    }
    return this._makeFileView(
      absPath,
      parsePipelineFile(content, { maa: this.maa, parser: this.parser })
    )
  }

  private async _loadDefaultConfig(bundlePath: AbsolutePath): Promise<DefaultConfig | null> {
    const defaultPath = this.pathUtils.join(bundlePath, 'default_pipeline.json')
    const content = await this.loader.get(defaultPath)
    if (content === null) {
      return null
    }
    const parsed = parsePipelineFile(content, {
      maa: this.maa,
      isDefault: true,
      parser: this.parser
    })
    const annotated = new Map<TaskName, TaskInfoInFile>()
    for (const [name, info] of parsed.tasks) {
      annotated.set(name, {
        parts: info.parts,
        decls: info.decls.map(d => ({ ...d, file: defaultPath })),
        refs: info.refs.map(r => ({ ...r, file: defaultPath }))
      })
    }
    return annotated
  }

  private _isImportFile(rel: string): boolean {
    if (!this._interfaceData) {
      return false
    }
    return (this._interfaceData.import as readonly string[] | undefined)?.includes(rel) ?? false
  }

  private async _reloadPipelineFile(bundleIndex: number, relPath: RelativePath): Promise<void> {
    const bundle = this._bundles[bundleIndex]
    const pipelineRoot = this.pathUtils.join(bundle.root, this._pipelineDir)
    const absPath = this.pathUtils.join(pipelineRoot, relPath)
    const fv = await this._loadPipelineFile(absPath)

    const newFiles = new Map(bundle.files)
    if (fv) {
      newFiles.set(relPath, fv)
    } else {
      newFiles.delete(relPath)
    }

    this._replaceBundle(
      bundleIndex,
      createBundleView({
        root: bundle.root,
        files: newFiles,
        images: bundle.images,
        defaultConfig: bundle.defaultConfig
      })
    )
  }

  private _removePipelineFile(bundleIndex: number, relPath: RelativePath): void {
    const bundle = this._bundles[bundleIndex]
    const newFiles = new Map(bundle.files)
    newFiles.delete(relPath)

    this._replaceBundle(
      bundleIndex,
      createBundleView({
        root: bundle.root,
        files: newFiles,
        images: bundle.images,
        defaultConfig: bundle.defaultConfig
      })
    )
  }

  private _updateBundleImage(bundleIndex: number, imagePath: string, added: boolean): void {
    const bundle = this._bundles[bundleIndex]
    const newImages = new Set(bundle.images)
    if (added) {
      newImages.add(imagePath as ImageRelativePath)
    } else {
      newImages.delete(imagePath as ImageRelativePath)
    }

    this._replaceBundle(
      bundleIndex,
      createBundleView({
        root: bundle.root,
        files: bundle.files,
        images: newImages,
        defaultConfig: bundle.defaultConfig
      })
    )
  }

  private async _reloadDefaultConfig(bundleIndex: number): Promise<void> {
    const bundle = this._bundles[bundleIndex]
    const defaultPath = this.pathUtils.join(bundle.root, 'default_pipeline.json')
    const content = await this.loader.get(defaultPath)

    let defaultConfig: DefaultConfig | null = null
    const newFiles = new Map(bundle.files)
    if (content !== null) {
      defaultConfig = this._makeDefaultConfig(
        defaultPath,
        parsePipelineFile(content, { maa: this.maa, isDefault: true, parser: this.parser })
      )
      newFiles.set(
        'default_pipeline.json' as RelativePath,
        this._makeFileView(
          defaultPath,
          parsePipelineFile(content, { maa: this.maa, parser: this.parser }),
          true
        )
      )
    } else {
      newFiles.delete('default_pipeline.json' as RelativePath)
    }

    this._replaceBundle(
      bundleIndex,
      createBundleView({
        root: bundle.root,
        files: newFiles,
        images: bundle.images,
        defaultConfig
      })
    )
  }

  private _replaceBundle(index: number, bundle: BundleView): void {
    const next = [...this._bundles]
    next[index] = bundle
    this._bundles = next
    this._buildSnapshot()
  }
}
