import { Snapshot } from '../snapshot/snapshot'
import type { Diagnostic } from './types'
import { adjustForAttrPrefix, diagPos, imageRefTarget, taskRefTarget } from './utils'

export function checkPipeline(snapshot: Parameters<typeof Snapshot.allDecls>[0]): Diagnostic[] {
  const result: Diagnostic[] = []

  const decls = Snapshot.allDecls(snapshot)
  const refs = Snapshot.allRefs(snapshot)
  const taskList = new Set(Snapshot.listTasks(snapshot))
  const anchors = new Set(Snapshot.getAnchorList(snapshot).map(([name]) => name))
  const images = new Set<string>(Snapshot.listImages(snapshot))
  const imageFolders = new Set<string>()
  for (const img of images) {
    const slash = img.lastIndexOf('/')
    if (slash !== -1) {
      imageFolders.add(img.slice(0, slash))
    }
  }

  // conflict-task: detect across files/bundles
  const taskDecls = decls.filter(d => d.type === 'task.decl')
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

  // Walk refs
  for (const ref of refs) {
    const file = ref.file
    const loc = diagPos(ref.location, file)

    // duplicate-next
    const taskRef = taskRefTarget(ref)
    if (taskRef !== null) {
      if (!taskList.has(taskRef) && taskRef !== '') {
        let detailLoc = loc
        if (ref.type === 'task.next' && ref.attrs.offset > 0) {
          detailLoc = { ...loc, ...adjustForAttrPrefix(loc, ref.attrs) }
        }
        result.push({
          level:
            ref.type === 'task.custom_task' && ref.meta.missingPolicy === 'ignore'
              ? 'warning'
              : 'error',
          ...detailLoc,
          type: 'unknown-task',
          task: taskRef
        })
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
      let imagePath = imageRef
      let isFolder = false
      if (imageFolders.has(imagePath)) {
        isFolder = true
      }
      if (imagePath.includes('\\')) {
        result.push({ level: 'warning', ...loc, type: 'image-path-back-slash' })
        imagePath = imagePath.replaceAll('\\', '/') as typeof imageRef
      }
      if (imagePath.startsWith('./')) {
        result.push({ level: 'warning', ...loc, type: 'image-path-dot-slash' })
        imagePath = imagePath.replace('./', '') as typeof imageRef
      }
      if (isFolder) {
        continue
      }
      if (!images.has(imagePath as string)) {
        result.push({
          level:
            ref.type === 'task.custom_template' && ref.meta.missingPolicy === 'ignore'
              ? 'warning'
              : 'error',
          ...loc,
          type: 'unknown-image',
          image: imageRef
        })
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
        if (!anchors.has(anchorRef as never)) {
          let policy: 'warning' | 'error' = 'error'
          if (ref.type === 'task.custom_anchor' && ref.meta.missingPolicy === 'ignore') {
            policy = 'warning'
          }
          result.push({
            level: policy,
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
