import type { InterfaceDeclInFile, InterfaceFileView, InterfaceRefInFile, ParsedInterface } from '../interface/types'
import type { TaskDeclInFile, TaskRefInFile } from '../pipeline/types'
import type { AbsolutePath, ImageRelativePath, TaskName } from '../types'
import { BundleView, type BundleView as BundleViewType } from './bundle-view'

export type { BundleView as BundleViewType, DefaultConfig } from './bundle-view'
export type { FileView } from './file-view'

export type LanguageInfo = {
  readonly name: string
  readonly file: AbsolutePath
  readonly entries: ReadonlyMap<string, string>
}

export type DeclWithBundle = TaskDeclInFile & { bundleIndex: number }
export type RefWithBundle = TaskRefInFile & { bundleIndex: number }

export type ResourceSnapshot = {
  readonly bundles: readonly BundleViewType[]
  /** 合并后的 interface 数据（controller/resource/task/option... Records，import 已合并） */
  readonly interfaceData: ParsedInterface | null
  /** 各 interface 文件独立视图——decls/refs 未合并，惰性查询时拼接 */
  readonly interfaceFiles: readonly InterfaceFileView[]
  readonly interfaceFile: AbsolutePath
  readonly languages: readonly LanguageInfo[]
  readonly activeController: string
  readonly activeResource: string
}

export function createSnapshot(opts: {
  bundles: readonly BundleViewType[]
  interfaceData?: ParsedInterface | null
  interfaceFiles?: readonly InterfaceFileView[]
  interfaceFile?: AbsolutePath
  languages?: readonly LanguageInfo[]
  activeController?: string
  activeResource?: string
}): ResourceSnapshot {
  return Object.freeze({
    bundles: Object.freeze([...opts.bundles]),
    interfaceData: opts.interfaceData ?? null,
    interfaceFiles: opts.interfaceFiles ?? [],
    interfaceFile: opts.interfaceFile ?? ('' as AbsolutePath),
    languages: Object.freeze([...opts.languages ?? []]),
    activeController: opts.activeController ?? '',
    activeResource: opts.activeResource ?? ''
  })
}

export const Snapshot = {
  locateBundle(snapshot: ResourceSnapshot, path: string) {
    for (const bundle of snapshot.bundles) {
      for (const file of bundle.files.values()) {
        if (file.path === path) {
          return { bundle, file }
        }
      }
    }
    return null
  },

  /**
   * 跨 Bundle 查找任务定义。
   *
   * 按 `resource[].path` 顺序从后向前遍历 Bundle（后加载覆盖先加载）。
   * Bundle 内部按文件名字母序查找（见 BundleView.findTask）。
   *
   * 这是纯查找——仅返回最高优先级的任务定义，不合并 defaultConfig。
   * defaultConfig 继承 + 属性合并由 `resolveTask()` 处理（未来 phase）。
   */
  findTask(snapshot: ResourceSnapshot, name: TaskName) {
    for (let i = snapshot.bundles.length - 1; i >= 0; i--) {
      const info = BundleView.findTask(snapshot.bundles[i], name)
      if (info) {
        return info
      }
    }
    return null
  },

  listTasks(snapshot: ResourceSnapshot): TaskName[] {
    const all = new Set<TaskName>()
    for (const bundle of snapshot.bundles) {
      for (const name of BundleView.listTasks(bundle)) {
        all.add(name)
      }
    }
    return [...all]
  },

  allDecls(snapshot: ResourceSnapshot): DeclWithBundle[] {
    const result: DeclWithBundle[] = []
    for (let i = 0; i < snapshot.bundles.length; i++) {
      for (const decl of BundleView.allDecls(snapshot.bundles[i])) {
        result.push({ ...decl, bundleIndex: i })
      }
    }
    return result
  },

  allRefs(snapshot: ResourceSnapshot): RefWithBundle[] {
    const result: RefWithBundle[] = []
    for (let i = 0; i < snapshot.bundles.length; i++) {
      for (const ref of BundleView.allRefs(snapshot.bundles[i])) {
        result.push({ ...ref, bundleIndex: i })
      }
    }
    return result
  },

  /** 惰性合并所有 interface 文件的 decls（各文件保持独立存储，查询时拼接） */
  allInterfaceDecls(snapshot: ResourceSnapshot): InterfaceDeclInFile[] {
    return snapshot.interfaceFiles.flatMap(f => [...f.decls])
  },

  /** 惰性合并所有 interface 文件的 refs */
  allInterfaceRefs(snapshot: ResourceSnapshot): InterfaceRefInFile[] {
    return snapshot.interfaceFiles.flatMap(f => [...f.refs])
  },

  listImages(snapshot: ResourceSnapshot): ImageRelativePath[] {
    const all = new Set<ImageRelativePath>()
    for (const bundle of snapshot.bundles) {
      for (const img of BundleView.getImageList(bundle)) {
        all.add(img)
      }
    }
    return [...all]
  },

  getAnchorList(snapshot: ResourceSnapshot) {
    const result: ReturnType<typeof BundleView.getAnchorList> = []
    for (const bundle of snapshot.bundles) {
      result.push(...BundleView.getAnchorList(bundle))
    }
    return result
  },

  getImageFolders(snapshot: ResourceSnapshot) {
    const result = new Map<ImageRelativePath, BundleViewType[]>()
    for (const bundle of snapshot.bundles) {
      for (const [dir, dirBundles] of BundleView.getImageFolders(bundle)) {
        const existing = result.get(dir)
        if (existing) {
          for (const b of dirBundles) {
            if (!existing.includes(b)) {
              existing.push(b)
            }
          }
        } else {
          result.set(dir, [...dirBundles])
        }
      }
    }
    return result
  },

  withBundle(snapshot: ResourceSnapshot, index: number, bundle: BundleViewType): ResourceSnapshot {
    const next = [...snapshot.bundles]
    next[index] = bundle
    return createSnapshot({
      bundles: next,
      interfaceData: snapshot.interfaceData,
      interfaceFiles: snapshot.interfaceFiles,
      interfaceFile: snapshot.interfaceFile,
      languages: snapshot.languages,
      activeController: snapshot.activeController,
      activeResource: snapshot.activeResource
    })
  }
}
