/**
 * I/O 抽象接口，隔离 Node.js 文件系统依赖。
 * 核心模块通过 IContentLoader 读取文件，通过 IContentWatcher 监视文件变更。
 */

export interface IContentLoader {
  /** 读取文件内容，文件不存在时返回 null */
  get(file: string): Promise<string | null>

  /** 列出目录下的文件（递归），返回相对路径 */
  listFiles(dir: string): Promise<string[]>
}

export interface IContentWatcherDelegate {
  /** 决定是否监视该文件 */
  filter(file: string, isdir: boolean): boolean

  fileAdded(file: string): void
  fileChanged(file: string): void
  fileDeleted(file: string): void
}

export interface IContentWatcherController {
  stop(): void
}

export interface IContentWatcher {
  watch(
    root: string,
    isFile: boolean,
    delegate: IContentWatcherDelegate
  ): Promise<IContentWatcherController>
}
