import type { TaskInfo } from '../pipeline/types'
import type { AnchorName, ImageRelativePath, TaskName } from '../types'
import { FileView } from './file-view'

export type DefaultConfig = ReadonlyMap<TaskName, { obj: unknown }>

export type BundleView = {
  readonly root: string
  readonly files: ReadonlyMap<string, FileView>
  readonly images: ReadonlySet<ImageRelativePath>
  readonly defaultConfig: DefaultConfig | null
  readonly maa: boolean
}

export function createBundleView(opts: {
  root: string
  files: ReadonlyMap<string, FileView>
  images: ReadonlySet<ImageRelativePath>
  defaultConfig?: DefaultConfig | null
  maa?: boolean
}): BundleView {
  return {
    root: opts.root,
    files: opts.files,
    images: opts.images,
    defaultConfig: opts.defaultConfig ?? null,
    maa: opts.maa ?? false
  }
}

export const BundleView = {
  findTask(bundle: BundleView, name: TaskName): TaskInfo | null {
    let found: TaskInfo | null = null
    for (const file of bundle.files.values()) {
      const info = file.tasks.get(name)
      if (info) {
        found = info
      }
    }
    return found
  },

  listTasks(bundle: BundleView): TaskName[] {
    const all = new Set<TaskName>()
    for (const file of bundle.files.values()) {
      for (const name of file.tasks.keys()) {
        all.add(name)
      }
    }
    return [...all]
  },

  allDecls(bundle: BundleView) {
    const result: TaskInfo['decls'] = []
    for (const file of bundle.files.values()) {
      result.push(...FileView.allDecls(file))
    }
    return result
  },

  allRefs(bundle: BundleView) {
    const result: TaskInfo['refs'] = []
    for (const file of bundle.files.values()) {
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
