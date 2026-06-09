import { mergeInterfaces } from '../interface/merge'
import { parseInterface } from '../interface/parser'
import type { InterfaceParseResult } from '../interface/types'
import type { IContentLoader } from '../io/types'
import type { IPathUtils } from '../path/interface'
import { extname } from '../path/utils'
import { parsePipelineFile } from '../pipeline/fw'
import type { TaskInfo } from '../pipeline/types'
import { createBundleView, createSnapshot } from '../snapshot'
import type { BundleView, DefaultConfig } from '../snapshot/bundle-view'
import type { FileView } from '../snapshot/file-view'
import type { ResourceSnapshot } from '../snapshot/snapshot'
import type { ImageRelativePath, TaskName } from '../types'

const PIPELINE_EXTENSIONS = new Set(['.json', '.jsonc'])
const IMAGE_EXTENSIONS = new Set(['.png'])

export class Project {
  readonly loader: IContentLoader
  readonly pathUtils: IPathUtils
  readonly maa: boolean

  /** 项目根目录（interface.json 所在目录） */
  readonly root: string

  private _bundles: readonly BundleView[] = []
  private _parsedInterface: InterfaceParseResult | null = null
  private _snapshot: ResourceSnapshot | null = null
  private _activeController: string | null = null
  private _activeResource: string | null = null

  /** 当前解析后的 interface（含 import 合并） */
  get parsedInterface(): InterfaceParseResult | null {
    return this._parsedInterface
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

  constructor(loader: IContentLoader, pathUtils: IPathUtils, maa: boolean, root: string) {
    this.loader = loader
    this.pathUtils = pathUtils
    this.maa = maa
    this.root = root
  }

  /** 加载并解析 interface.json，包括 import 文件的合并 */
  async loadInterface(filename = 'interface.json'): Promise<void> {
    const filePath = this.pathUtils.join(this.root, filename)
    const content = await this.loader.get(filePath)
    if (!content) {
      throw new Error(`Cannot read interface file: ${filePath}`)
    }

    const base = parseInterface(content)
    if (!base) {
      throw new Error(`Failed to parse interface file: ${filePath}`)
    }

    const imports = base.data.import ?? []
    const importResults: InterfaceParseResult[] = []
    for (const imp of imports) {
      const impPath = this.pathUtils.join(this.root, imp as string)
      const impContent = await this.loader.get(impPath)
      if (impContent) {
        const parsed = parseInterface(impContent)
        if (parsed) {
          importResults.push(parsed)
        }
      }
    }

    this._parsedInterface =
      importResults.length > 0 ? mergeInterfaces(base, ...importResults) : base
  }

  /** 加载一个资源目录为 BundleView */
  async loadBundle(bundlePath: string): Promise<BundleView> {
    const pipelineDir = this._pipelineDir
    const imageDir = this._imageDir
    const pipelineRoot = this.pathUtils.join(bundlePath, pipelineDir)
    const imageRoot = this.pathUtils.join(bundlePath, imageDir)

    const allPipelineFiles = await this.loader.listFiles(pipelineRoot)
    const jsonFiles = allPipelineFiles.filter(f => PIPELINE_EXTENSIONS.has(extname(f)))

    const files = new Map<string, FileView>()
    for (const rel of jsonFiles) {
      const absPath = this.pathUtils.join(pipelineRoot, rel)
      const parsed = await this._loadPipelineFile(absPath)
      if (parsed) {
        files.set(rel, parsed)
      }
    }

    const defaultConfig = await this._loadDefaultConfig(bundlePath)

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
    if (!this._parsedInterface) {
      throw new Error('Interface not loaded. Call loadInterface() first.')
    }

    const resName = this._activeResource
    if (!resName) {
      this._bundles = []
      this._buildSnapshot()
      return
    }

    const resInfo = this._parsedInterface.data.resource[resName]
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

    this._bundles = bundles
    this._buildSnapshot()
  }

  /** 根据绝对路径查找所属 Bundle 的索引，-1 表示不属于任何 Bundle */
  findBundleIndex(absPath: string): number {
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
  async handleFileChange(absPath: string, action: 'added' | 'changed' | 'deleted'): Promise<void> {
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
      const relPath = bundleRel.slice(pipelineDir.length + 1)
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
    if (this._parsedInterface) {
      await this.loadBundles()
    }
  }

  private _buildSnapshot(): void {
    this._snapshot = createSnapshot({
      bundles: this._bundles,
      interface: this._parsedInterface ?? undefined
    })
  }

  private get _pipelineDir(): string {
    return this.maa ? 'tasks' : 'pipeline'
  }

  private get _imageDir(): string {
    return this.maa ? 'template' : 'image'
  }

  private async _loadPipelineFile(absPath: string): Promise<FileView | null> {
    const content = await this.loader.get(absPath)
    if (content === null) {
      return null
    }
    const parsed = parsePipelineFile(content, { maa: this.maa })
    return Object.freeze({
      path: absPath,
      tasks: parsed.tasks as ReadonlyMap<TaskName, TaskInfo>,
      fileDecls: parsed.fileDecls
    } satisfies FileView)
  }

  private async _loadDefaultConfig(bundlePath: string): Promise<DefaultConfig | null> {
    const defaultPath = this.pathUtils.join(bundlePath, 'default_pipeline.json')
    const content = await this.loader.get(defaultPath)
    if (content === null) {
      return null
    }
    const parsed = parsePipelineFile(content, { maa: this.maa, isDefault: true })
    return parsed.tasks as DefaultConfig
  }

  private _isImportFile(rel: string): boolean {
    if (!this._parsedInterface) {
      return false
    }
    return (
      (this._parsedInterface.data.import as readonly string[] | undefined)?.includes(rel) ?? false
    )
  }

  private async _reloadPipelineFile(bundleIndex: number, relPath: string): Promise<void> {
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

  private _removePipelineFile(bundleIndex: number, relPath: string): void {
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
    const defaultConfig = await this._loadDefaultConfig(bundle.root)

    this._replaceBundle(
      bundleIndex,
      createBundleView({
        root: bundle.root,
        files: bundle.files,
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
