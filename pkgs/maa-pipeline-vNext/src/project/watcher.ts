import type { IContentLoader, IContentWatcher, IContentWatcherController } from '../io/types'
import type { IPathUtils } from '../path/interface'
import type { ResourceSnapshot } from '../snapshot/snapshot'
import type { AbsolutePath } from '../types'
import { Project } from './project'

/**
 * 带文件监视的 Project。
 *
 * 启动监视后，文件变更时按粒度更新：
 * - interface/import 文件 → 全量重载
 * - pipeline JSON 文件 → 只重载该文件 + 重建所属 Bundle
 * - 图像文件 → 只更新图像集合 + 重建所属 Bundle
 * - 全部完成后通过 onChange 回调通知 consumer。
 */
export class WatchedProject extends Project {
  readonly watcher: IContentWatcher

  /** 文件变更时触发 */
  onChange: ((snapshot: ResourceSnapshot) => void) | null = null

  private _watcherCtrl: IContentWatcherController | null = null

  constructor(
    loader: IContentLoader,
    watcher: IContentWatcher,
    pathUtils: IPathUtils,
    maa: boolean,
    root: string
  ) {
    super(loader, pathUtils, maa, root)
    this.watcher = watcher
  }

  /** 启动文件监视——初始加载完成后开始监听变更 */
  async startWatching(): Promise<void> {
    await this.loadInterface()
    await this.loadBundles()

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

  /** 停止文件监视 */
  stopWatching(): void {
    this._watcherCtrl?.stop()
    this._watcherCtrl = null
  }

  private _onFileChange(action: 'added' | 'changed' | 'deleted', file: string): void {
    this.handleFileChange(file as AbsolutePath, action)
      .then(() => {
        if (this.snapshot && this.onChange) {
          this.onChange(this.snapshot)
        }
      })
      .catch(err => {
        console.error('WatchedProject: file change handling failed', err)
      })
  }
}
