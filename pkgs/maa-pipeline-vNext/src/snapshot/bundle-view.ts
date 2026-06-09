import type { TaskDeclInFile, TaskInfoInFile, TaskRefInFile } from '../pipeline/types'
import type { AbsolutePath, AnchorName, ImageRelativePath, TaskName } from '../types'
import { FileView } from './file-view'

/** default_pipeline.json 的解析结果——已标注文件路径 */
export type DefaultConfig = ReadonlyMap<TaskName, TaskInfoInFile>

export type BundleView = {
  readonly root: AbsolutePath
  readonly files: ReadonlyMap<string, FileView>
  readonly images: ReadonlySet<ImageRelativePath>
  readonly defaultConfig: DefaultConfig | null
  readonly maa: boolean
}

export function createBundleView(opts: {
  root: AbsolutePath
  files: ReadonlyMap<string, FileView>
  images: ReadonlySet<ImageRelativePath>
  defaultConfig?: DefaultConfig | null
  maa?: boolean
}): BundleView {
  return Object.freeze({
    root: opts.root,
    files: opts.files,
    images: opts.images,
    defaultConfig: opts.defaultConfig ?? null,
    maa: opts.maa ?? false
  })
}

/** 按文件名字母序排序——匹配 MaaFramework 按字母序加载 pipeline 文件的行为 */
function sortedFiles(bundle: BundleView): FileView[] {
  return [...bundle.files.keys()]
    .sort()
    .map(k => bundle.files.get(k)!)
}

export const BundleView = {
  /**
   * 在 Bundle 内查找任务定义。
   *
   * 文件按字母序遍历，同文件内 Map 保留 JSON key 顺序（后出现覆盖先出现）。
   * 多个文件中出现同名任务时，字母序靠后的文件覆盖靠前的。
   *
   * 这是纯查找——不合并 defaultConfig。defaultConfig 继承由 `resolveTask()` 处理（未来 phase）。
   */
  findTask(bundle: BundleView, name: TaskName): TaskInfoInFile | null {
    let found: TaskInfoInFile | null = null
    for (const file of sortedFiles(bundle)) {
      const info = file.tasks.get(name)
      if (info) {
        found = info
      }
    }
    return found
  },

  listTasks(bundle: BundleView): TaskName[] {
    const all = new Set<TaskName>()
    for (const file of sortedFiles(bundle)) {
      for (const name of file.tasks.keys()) {
        all.add(name)
      }
    }
    return [...all]
  },

  allDecls(bundle: BundleView): TaskDeclInFile[] {
    const result: TaskDeclInFile[] = []
    for (const file of sortedFiles(bundle)) {
      result.push(...FileView.allDecls(file))
    }
    return result
  },

  allRefs(bundle: BundleView): TaskRefInFile[] {
    const result: TaskRefInFile[] = []
    for (const file of sortedFiles(bundle)) {
      result.push(...FileView.allRefs(file))
    }
    return result
  },

  getAnchorList(bundle: BundleView): [AnchorName, { anchor: AnchorName; belong: TaskName }][] {
    const result: [AnchorName, { anchor: AnchorName; belong: TaskName }][] = []
    for (const decl of BundleView.allDecls(bundle)) {
      if (decl.type === 'task.anchor') {
        result.push([decl.anchor, { anchor: decl.anchor, belong: decl.belong }])
      }
    }
    return result
  },

  getImageList(bundle: BundleView): ImageRelativePath[] {
    return [...bundle.images]
  },

  getImageFolders(bundle: BundleView): Map<ImageRelativePath, BundleView[]> {
    const result = new Map<ImageRelativePath, BundleView[]>()
    for (const image of bundle.images) {
      const slash = image.lastIndexOf('/')
      if (slash !== -1) {
        const dir = image.slice(0, slash) as ImageRelativePath
        const existing = result.get(dir)
        if (existing) {
          existing.push(bundle)
        } else {
          result.set(dir, [bundle])
        }
      }
    }
    return result
  }
}
