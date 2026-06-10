import { BundleView } from '../snapshot/bundle-view'
import type { ResourceSnapshot } from '../snapshot/snapshot'
import { Snapshot } from '../snapshot/snapshot'
import type { TaskName } from '../types'
import type { Diagnostic } from './types'
import { adjustForAttrPrefix, diagPos, imageRefTarget, taskRefTarget } from './utils'

export function checkPipeline(snapshot: ResourceSnapshot): Diagnostic[] {
  const result: Diagnostic[] = []

  const decls = Snapshot.allDecls(snapshot)
  const refs = Snapshot.allRefs(snapshot)
  // per-bundle 累进 taskList: taskLists[i] = bundles[0..i] 的任务集合
  const taskLists: Set<TaskName>[] = []
  const accum = new Set<TaskName>()
  for (const bundle of snapshot.bundles) {
    for (const t of BundleView.listTasks(bundle)) {
      accum.add(t)
    }
    taskLists.push(new Set(accum))
  }
  const allTaskList = taskLists[taskLists.length - 1] ?? new Set<TaskName>()
  const anchors = new Set<string>(Snapshot.getAnchorList(snapshot).map(([name]) => name))
  const images = new Set<string>(Snapshot.listImages(snapshot))
  const imageFolders = new Set<string>()
  for (const img of images) {
    const slash = img.lastIndexOf('/')
    if (slash !== -1) {
      imageFolders.add(img.slice(0, slash))
    }
  }

  // conflict-task: 在每个 non-interface bundle 内检测同名 task。
  // interface bundle 允许多个 override 定义同名 task。
  for (const bundle of snapshot.bundles) {
    if (bundle.isInterface) {
      continue
    }
    const taskDecls = BundleView.allDecls(bundle).filter(d => d.type === 'task.decl')
    const byName = new Map<string, typeof taskDecls>()
    for (const d of taskDecls) {
      const arr = byName.get(d.task) ?? []
      arr.push(d)
      byName.set(d.task, arr)
    }
    for (const [, entries] of byName) {
      if (entries.length > 1) {
        const [first, ...rest] = entries
        for (const dup of rest) {
          result.push({
            level: 'error',
            ...diagPos(dup.location, dup.file),
            type: 'conflict-task',
            task: dup.task,
            previous: diagPos(first.location, first.file)
          })
        }
      }
    }
  }

  // mpe-config
  for (const d of decls) {
    if (d.type === 'task.mpe_config') {
      result.push({
        level: 'warning',
        ...diagPos(d.location, d.file),
        type: 'mpe-config'
      })
    }
  }

  // duplicate-next: 同一任务中 next 数组出现重复引用
  for (const taskName of allTaskList) {
    const taskInfo = Snapshot.findTask(snapshot, taskName)
    if (!taskInfo) continue
    const nextRefs = taskInfo.refs
      .filter(r => r.type === 'task.next' && !r.attrs.attrs.Anchor)
      .sort((a, b) => a.location.offset - b.location.offset)
    const seen = new Set<string>()
    for (const _ref of nextRefs) {
      const ref = _ref as typeof _ref & { target: string }
      if (seen.has(ref.target)) {
        result.push({
          level: 'error',
          ...diagPos(ref.location, ref.file),
          type: 'duplicate-next',
          task: ref.target
        })
      }
      seen.add(ref.target)
    }
  }

  // Walk refs
  for (const ref of refs) {
    const file = ref.file
    const loc = diagPos(ref.location, file)

    // duplicate-next
    const taskRef = taskRefTarget(ref)
    if (taskRef !== null) {
      if (!taskLists[ref.bundleIndex].has(taskRef) && !(taskRef === '' && ref.type === 'task.anchor')) {
        let detailLoc = loc
        if (ref.type === 'task.next' && ref.attrs.offset > 0) {
          detailLoc = { ...loc, ...adjustForAttrPrefix(loc, ref.attrs) }
        }
        const policy =
          ref.type === 'task.custom_task' ? ref.meta.missingPolicy : undefined
        if (policy !== 'ignore') {
          result.push({
            level: policy ?? 'error',
            ...detailLoc,
            type: 'unknown-task',
          task: taskRef
        })
        }
      }

      if (ref.type === 'task.color_filter') {
        // TODO: check reco type from Snapshot
        const taskInfo = Snapshot.findTask(snapshot, ref.target)
        if (taskInfo) {
          const reco = taskInfo.parts.recoType?.value
          if (reco !== 'ColorMatch') {
            result.push({
              level: 'error',
              ...loc,
              type: 'color-filter-invalid',
              task: ref.target,
              reco: reco ?? 'DirectHit'
            })
          }
        }
      }
    }

    // image refs
    const imageRef = imageRefTarget(ref)
    if (imageRef !== null) {
      const maa = snapshot.bundles[ref.bundleIndex]?.maa ?? false
      let imagePath = imageRef
      let isFolder = false

      // dynamic-image: 非 MAA 模式下，路径不以 .png 结尾且不是已知文件夹 → 可能是动态路径
      if (!maa && !imagePath.endsWith('.png')) {
        if (imageFolders.has(imagePath as string)) {
          isFolder = true
        } else {
          result.push({ level: 'warning', ...loc, type: 'dynamic-image' })
          continue
        }
      }
      if (imagePath.includes('\\')) {
        result.push({ level: 'warning', ...loc, type: 'image-path-back-slash' })
        imagePath = imagePath.replaceAll('\\', '/') as typeof imageRef
      }
      if (imagePath.startsWith('./')) {
        result.push({ level: 'warning', ...loc, type: 'image-path-dot-slash' })
        imagePath = imagePath.replace('./', '') as typeof imageRef
      }

      // image-path-missing-png: MAA 模式下，路径不以 .png 结尾 → 建议补全
      if (maa && !imagePath.endsWith('.png')) {
        result.push({ level: 'warning', ...loc, type: 'image-path-missing-png' })
        imagePath = (imagePath + '.png') as typeof imageRef
      }
      if (isFolder) {
        continue
      }
      if (!images.has(imagePath as string)) {
        const tplPolicy =
          ref.type === 'task.custom_template' ? ref.meta.missingPolicy : undefined
        if (tplPolicy !== 'ignore') {
          result.push({
            level: tplPolicy ?? 'error',
            ...loc,
            type: 'unknown-image',
            image: imageRef
          })
        }
      }
    }

    // anchor refs
    if (
      ref.type === 'task.next' ||
      ref.type === 'task.roi' ||
      ref.type === 'task.target' ||
      ref.type === 'task.custom_anchor'
    ) {
      if (ref.attrs.attrs.Anchor) {
        const anchorRef = ref.target
        if (!anchors.has(anchorRef)) {
          const anchorPolicy =
            ref.type === 'task.custom_anchor' ? ref.meta.missingPolicy : undefined
          if (anchorPolicy !== 'ignore') {
            result.push({
              level: anchorPolicy ?? 'error',
              ...{
                ...loc,
                ...adjustForAttrPrefix(loc, ref.attrs)
              },
              type: 'unknown-anchor',
              anchor: anchorRef
            })
        }
      }
      }
    }

    // locale refs
    if (ref.type === 'task.locale') {
      const infos = snapshot.languages.map(lang => lang.entries.get(ref.target) ?? null)
      if (!infos.find(info => !!info)) {
        result.push({ level: 'error', ...loc, type: 'unknown-locale', locale: ref.target })
      } else {
        const missing: string[] = []
        for (const [idx, info] of infos.entries()) {
          if (!info) {
            missing.push(snapshot.languages[idx].name)
          }
        }
        if (missing.length > 0) {
          result.push({
            level: 'error',
            ...loc,
            type: 'missing-locale',
            locale: ref.target,
            langs: missing
          })
        }
      }
    }

    // unknown attr
    if (ref.type === 'task.next' || ref.type === 'task.roi' || ref.type === 'task.target') {
      const attrsRef = ref
      if (attrsRef.attrs.unknown.length > 0) {
        for (const [attr, attrOffset, attrLength] of attrsRef.attrs.unknown) {
          result.push({
            level: 'error',
            ...{ ...loc, offset: loc.offset + 2 + attrOffset, length: attrLength - 2 },
            type: 'unknown-attr',
            attr
          })
        }
      }
    }
  }

  return result
}
