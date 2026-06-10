import type {
  InterfaceDeclInFile,
  InterfaceFileView,
  InterfaceRefInFile,
  ParsedInterface
} from '../interface/types'
import type { TaskDeclInFile, TaskRefInFile } from '../pipeline/types'
import type { AbsolutePath, ImageRelativePath, TaskName } from '../types'
import {
  BundleView,
  type BundleView as BundleViewType,
  type ResolvedTaskConfig,
  mergeIntoDefaults
} from './bundle-view'

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
  readonly interfaceData: ParsedInterface | null
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
    languages: Object.freeze([...(opts.languages ?? [])]),
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

  /** 纯查找——不合并 defaultConfig。需要属性继承用 resolveTask。 */
  findTask(snapshot: ResourceSnapshot, name: TaskName) {
    for (let i = snapshot.bundles.length - 1; i >= 0; i--) {
      const info = BundleView.findTask(snapshot.bundles[i], name)
      if (info) {
        return info
      }
    }
    return null
  },

  /**
   * 渐进式解析——精确对应 MaaFramework PipelineResMgr::parse_and_override_once 的行为。
   *
   * 按 bundles 顺序从低到高遍历，累积 defaultConfig；
   * 首次定义使用当时的累积默认值，重定义仅叠加自身属性不重新 apply 默认值。
   */
  resolveTask(snapshot: ResourceSnapshot, name: TaskName): ResolvedTaskConfig | null {
    let resolved: ResolvedTaskConfig | null = null
    const cumulativeDefaults: Record<string, Record<string, unknown>> = {}

    for (let i = 0; i < snapshot.bundles.length; i++) {
      const bundle = snapshot.bundles[i]

      mergeIntoDefaults(cumulativeDefaults, bundle.defaultConfig)

      const info = BundleView.findTask(bundle, name)
      if (!info) {
        continue
      }

      if (!resolved) {
        resolved = BundleView.resolveFromInfo(info, bundle, cumulativeDefaults)
      } else {
        resolved = BundleView.resolveFromInfo(info, bundle, cumulativeDefaults, resolved.config)
      }
    }

    return resolved
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

  allInterfaceDecls(snapshot: ResourceSnapshot): InterfaceDeclInFile[] {
    return snapshot.interfaceFiles.flatMap(f => [...f.decls])
  },

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
