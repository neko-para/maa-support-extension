import type { IContentLoader, IContentWatcher, IContentWatcherController } from '../io/types'
import type { IPathUtils } from '../path/interface'
import type { ParserConfig } from '../pipeline/types'
import type { AbsolutePath } from '../types'
import { Project } from './project'

/**
 * 带文件监视的 Project。
 *
 * 启动监视后，文件变更时按粒度更新：
 * - interface/import 文件 → 全量重载
 * - pipeline JSON 文件 → 只重载该文件 + 重建所属 Bundle
 * - 图像文件 → 只更新图像集合 + 重建所属 Bundle
 * - 全部完成后通过 onSnapshotChange 回调通知 consumer。
 */
export class WatchedProject extends Project {
  readonly watcher: IContentWatcher

  private _watcherCtrl: IContentWatcherController | null = null

  constructor(
    loader: IContentLoader,
    watcher: IContentWatcher,
    pathUtils: IPathUtils,
    maa: boolean,
    root: string,
    parser?: ParserConfig
  ) {
    super(loader, pathUtils, maa, root, parser)
    this.watcher = watcher
  }

  /** 启动文件监视——加载 interface + bundles 后开始监听变更 */
  async startWatching(interfaceFile?: string): Promise<void> {
    await this.loadInterface(interfaceFile)
    await this.loadBundles()
    await this._setupWatcher()
  }

  /**
   * 仅启动文件监视器——前提是 interface 和 bundles 已通过其他方式加载。
   * 用于 InterfaceService 等自行管理加载时序的场景。
   */
  async beginWatch(): Promise<void> {
    await this._setupWatcher()
  }

  /** 停止文件监视 */
  stopWatching(): void {
    this._watcherCtrl?.stop()
    this._watcherCtrl = null
  }

  private async _setupWatcher(): Promise<void> {
    if (this._watcherCtrl) {
      return
    }
    this._watcherCtrl = await this.watcher.watch(this.root, false, {
      filter: (_file, _isdir) => {
        return true
      },

      fileAdded: file => {
        this._onFileChange('added', file)
      },
      fileChanged: file => {
        this._onFileChange('changed', file)
      },
      fileDeleted: file => {
        this._onFileChange('deleted', file)
      }
    })
  }

  private _onFileChange(action: 'added' | 'changed' | 'deleted', file: string): void {
    this.handleFileChange(file as AbsolutePath, action).catch(err => {
      console.error('WatchedProject: file change handling failed', err)
    })
  }
}
