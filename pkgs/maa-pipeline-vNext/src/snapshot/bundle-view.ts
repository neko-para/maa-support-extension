import type { IPathUtils } from '../path/interface'
import { actKeys, recoKeys } from '../pipeline/keys'
import type { TaskDeclInFile, TaskInfoInFile, TaskRefInFile } from '../pipeline/types'
import type { AbsolutePath, AnchorName, ImageRelativePath, RelativePath, TaskName } from '../types'
import { buildTree } from '../utils/json'
import { FileView } from './file-view'

export type DefaultConfig = ReadonlyMap<TaskName, TaskInfoInFile>

export type BundleView = {
  readonly root: AbsolutePath
  readonly files: ReadonlyMap<RelativePath, FileView>
  readonly images: ReadonlySet<ImageRelativePath>
  readonly defaultConfig: DefaultConfig | null
  readonly maa: boolean
}

export function createBundleView(opts: {
  root: AbsolutePath
  files: ReadonlyMap<RelativePath, FileView>
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

// resolveTask — Framework 模式专用。MAA 模式由 @nekosu/maa-tasker MaaEvalContext 处理。

const FRAMEWORK_DEFAULT_RECO = 'DirectHit'
const FRAMEWORK_DEFAULT_ACT = 'DoNothing'

export type ResolvedTaskConfig = {
  info: TaskInfoInFile
  config: Record<string, unknown>
  recoType: string
  actType: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** 属性层叠合并。`attach` dict merge，其余覆盖。 */
export function applyDefaultLayer(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): void {
  for (const [key, value] of Object.entries(source)) {
    if (key === 'attach' && isRecord(value)) {
      const existing = target[key]
      target[key] = Object.assign(isRecord(existing) ? existing : {}, value)
    } else {
      target[key] = value
    }
  }
}

/** DefaultConfig → `{ '$Default': {...}, '$TemplateMatch': {...}, ... }` */
export function buildDefaultsMap(
  dc: DefaultConfig | null
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {}
  if (!dc) {
    return result
  }
  for (const [key, info] of dc) {
    result[key] = buildTree(info.parts.node) as Record<string, unknown>
  }
  return result
}

/** 将一个 DefaultConfig 逐 `$Key` 合并到 target 中。 */
export function mergeIntoDefaults(
  target: Record<string, Record<string, unknown>>,
  dc: DefaultConfig | null
): void {
  if (!dc) {
    return
  }
  for (const [key, info] of dc) {
    const layer = buildTree(info.parts.node) as Record<string, unknown>
    if (target[key]) {
      applyDefaultLayer(target[key], layer)
    } else {
      target[key] = layer
    }
  }
}

function resolveFromInfo(
  info: TaskInfoInFile,
  _bundle: BundleView,
  defaults: Record<string, Record<string, unknown>>,
  baseConfig?: Record<string, unknown>
): ResolvedTaskConfig {
  const parts = info.parts
  const effectiveReco = parts.recoType?.value ?? FRAMEWORK_DEFAULT_RECO
  const effectiveAct = parts.actType?.value ?? FRAMEWORK_DEFAULT_ACT

  const isOverlay = baseConfig !== undefined
  const config: Record<string, unknown> = isOverlay ? { ...baseConfig } : {}

  // $Default — 仅首次定义，通用字段与类型无关
  if (!isOverlay && defaults['$Default']) {
    applyDefaultLayer(config, defaults['$Default'])
  }

  // 确定继承链中已有的类型
  const inheritedReco = isOverlay
    ? ((baseConfig.recognition as string) ?? FRAMEWORK_DEFAULT_RECO)
    : '$' + effectiveReco in defaults
      ? effectiveReco
      : FRAMEWORK_DEFAULT_RECO
  const inheritedAct = isOverlay
    ? ((baseConfig.action as string) ?? FRAMEWORK_DEFAULT_ACT)
    : '$' + effectiveAct in defaults
      ? effectiveAct
      : FRAMEWORK_DEFAULT_ACT

  const recoChanged = parts.recoType ? parts.recoType.value !== inheritedReco : false
  const actChanged = parts.actType ? parts.actType.value !== inheritedAct : false

  if (parts.recoType) {
    config['recognition'] = parts.recoType.value
  }
  if (parts.actType) {
    config['action'] = parts.actType.value
  }

  // 对应 MaaFramework C++: same_type ? parent_param : default_param
  if (recoChanged) {
    for (const key of recoKeys) {
      delete config[key]
    }
    const $reco = defaults['$' + effectiveReco]
    if ($reco) {
      applyDefaultLayer(config, $reco)
    }
  } else if (!isOverlay) {
    const $reco = defaults['$' + effectiveReco]
    if ($reco) {
      applyDefaultLayer(config, $reco)
    }
  }

  if (actChanged) {
    for (const key of actKeys) {
      delete config[key]
    }
    const $act = defaults['$' + effectiveAct]
    if ($act) {
      applyDefaultLayer(config, $act)
    }
  } else if (!isOverlay) {
    const $act = defaults['$' + effectiveAct]
    if ($act) {
      applyDefaultLayer(config, $act)
    }
  }

  for (const [key, obj] of [...parts.base, ...parts.reco, ...parts.act, ...parts.unknown]) {
    const value = buildTree(obj)
    if (key === 'attach' && isRecord(value)) {
      const existing = config[key]
      config[key] = Object.assign(isRecord(existing) ? existing : {}, value)
    } else {
      config[key] = value
    }
  }

  return { info, config, recoType: effectiveReco, actType: effectiveAct }
}

function resolve(
  bundle: BundleView,
  name: TaskName,
  defaults: Record<string, Record<string, unknown>>
): ResolvedTaskConfig | null {
  const info = BundleView.findTask(bundle, name)
  if (!info) {
    return null
  }
  return resolveFromInfo(info, bundle, defaults)
}

// ── image path utilities ──

/** 将图片相对路径中的 `\` 替换为 `/`，移除末尾 `/`。匹配 MaaFramework 的路径规范化行为。 */
export function normalizeImageFolder(
  pathUtils: IPathUtils,
  image: ImageRelativePath
): ImageRelativePath {
  let norm = pathUtils.normalize(image).replaceAll(pathUtils.sep, '/')
  if (norm.endsWith('/')) {
    norm = norm.slice(0, -1)
  }
  return norm as ImageRelativePath
}

/** 构建图片的绝对路径。MAA 模式使用 `template/` 目录，Framework 模式使用 `image/` 目录。 */
export function bundleImagePath(
  bundle: BundleView,
  pathUtils: IPathUtils,
  image: ImageRelativePath
): AbsolutePath {
  const dir = bundle.maa ? 'template' : 'image'
  return pathUtils.join(bundle.root, dir, image)
}

// ── BundleView namespace ──

/** 按文件名字母序排序——匹配 MaaFramework 按字母序加载 pipeline 文件的行为 */
function sortedFiles(bundle: BundleView): FileView[] {
  return [...bundle.files.keys()].sort().map(k => bundle.files.get(k)!)
}

export const BundleView = {
  resolveTask(
    bundle: BundleView,
    name: TaskName,
    mergedDefaults?: Record<string, Record<string, unknown>>
  ): ResolvedTaskConfig | null {
    const defaults = mergedDefaults ?? buildDefaultsMap(bundle.defaultConfig)
    return resolve(bundle, name, defaults)
  },

  resolveFromInfo(
    info: TaskInfoInFile,
    bundle: BundleView,
    defaults: Record<string, Record<string, unknown>>,
    baseConfig?: Record<string, unknown>
  ): ResolvedTaskConfig {
    return resolveFromInfo(info, bundle, defaults, baseConfig)
  },

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

  imagePath: bundleImagePath,

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
