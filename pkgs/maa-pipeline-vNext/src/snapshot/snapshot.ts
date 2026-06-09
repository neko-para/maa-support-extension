import type { InterfaceParseResult } from '../interface/types'
import type { TaskDeclInfo, TaskRefInfo } from '../pipeline/types'
import type { ImageRelativePath, TaskName } from '../types'
import { BundleView, type BundleView as BundleViewType } from './bundle-view'

export type { BundleView as BundleViewType, DefaultConfig } from './bundle-view'
export type { FileView } from './file-view'

export type LanguageInfo = {
  readonly name: string
  readonly file: string
  readonly entries: ReadonlyMap<string, string>
}

export type DeclWithBundle = TaskDeclInfo & { bundleIndex: number }
export type RefWithBundle = TaskRefInfo & { bundleIndex: number }

export type ResourceSnapshot = {
  readonly bundles: readonly BundleViewType[]
  readonly interface: InterfaceParseResult | null
  readonly languages: readonly LanguageInfo[]
  readonly activeController: string
  readonly activeResource: string
}

export function createSnapshot(opts: {
  bundles: readonly BundleViewType[]
  interface?: InterfaceParseResult | null
  languages?: readonly LanguageInfo[]
  activeController?: string
  activeResource?: string
}): ResourceSnapshot {
  return {
    bundles: opts.bundles,
    interface: opts.interface ?? null,
    languages: opts.languages ?? [],
    activeController: opts.activeController ?? '',
    activeResource: opts.activeResource ?? ''
  }
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
      interface: snapshot.interface,
      languages: snapshot.languages,
      activeController: snapshot.activeController,
      activeResource: snapshot.activeResource
    })
  }
}
