import type { InterfaceBundle } from '../interface/interface'
import type { TaskRefInfo } from '../parser/task/task'
import { extractTaskRef, isAnchorRef } from '../utils/helper'
import {
  type AnchorName,
  type ImageRelativePath,
  type TaskName,
  normalizeImageFolder
} from '../utils/types'
import type { Diagnostic } from './types'

export function checkTask(bundle: InterfaceBundle): Diagnostic[] {
  const result: Diagnostic[] = []

  for (const layer of bundle.allLayers) {
    for (const [name, taskInfos] of Object.entries(layer.tasks)) {
      if (taskInfos.length > 0 && layer.type !== 'interface') {
        for (const taskInfo of taskInfos.slice(1)) {
          result.push({
            level: 'error',
            file: taskInfo.file,
            offset: taskInfo.prop.offset,
            length: taskInfo.prop.length,

            type: 'conflict-task',
            task: name,
            previous: {
              file: taskInfos[0].file,
              offset: taskInfos[0].prop.offset,
              length: taskInfos[0].prop.length
            }
          })
        }
      }

      if (!bundle.maa) {
        for (const taskInfo of taskInfos) {
          const existsNext = new Set<TaskName>()
          const refs = taskInfo.info.refs.filter(
            ref => ref.type === 'task.next' && !ref.attrs.attrs.Anchor
          ) as (TaskRefInfo & {
            type: 'task.next'
          })[]
          refs.sort((a, b) => a.location.offset - b.location.offset)
          for (const ref of refs) {
            if (existsNext.has(ref.target)) {
              result.push({
                level: 'error',
                file: ref.file,
                offset: ref.location.offset,
                length: ref.location.length,
                type: 'duplicate-next',
                task: ref.target
              })
            } else {
              existsNext.add(ref.target)
            }
          }
        }
      }
    }

    const decls = layer.mergedDecls
    for (const decl of decls) {
      if (decl.type === 'task.mpe_config') {
        result.push({
          level: 'warning',
          file: decl.file,
          offset: decl.location.offset,
          length: decl.location.length,
          type: 'mpe-config'
        })
      }
    }

    const refs = layer.mergedRefs
    const tasks = new Set(layer.getTaskListNotUnique())
    const anchors = new Set(layer.getAnchorList().map(([anchor]) => anchor))
    const images = new Set(layer.getImageListNotUnique())
    const imageFolders = layer.getImageFolders()
    for (const ref of refs) {
      const task = extractTaskRef(ref)
      if (task !== null) {
        if (!tasks.has(task) && !(task === '' && ref.type === 'task.anchor')) {
          let offset = ref.location.offset
          let length = ref.location.length
          if (ref.type === 'task.next' && ref.attrs.offset > 0) {
            offset = ref.location.offset + ref.attrs.offset + 1
            length = ref.location.length - ref.attrs.offset - 2
          }
          result.push({
            level: 'error',
            file: ref.file,
            offset: offset,
            length: length,
            type: 'unknown-task',
            task: task
          })
        }
        if (ref.type === 'task.color_filter') {
          const { reco } = layer.getTaskBriefInfo(ref.target)
          if (reco !== 'ColorMatch') {
            result.push({
              level: 'error',
              file: ref.file,
              offset: ref.location.offset,
              length: ref.location.length,
              type: 'color-filter-invalid',
              task: task,
              reco: reco ?? 'DirectHit'
            })
          }
        }
      } else if (ref.type === 'task.template') {
        let imagePath = ref.target
        let isFolder = false
        if (!bundle.maa && !imagePath.endsWith('.png')) {
          const norm = normalizeImageFolder(imagePath)
          if (imageFolders.has(norm)) {
            isFolder = true
          } else {
            result.push({
              level: 'warning',
              file: ref.file,
              offset: ref.location.offset,
              length: ref.location.length,
              type: 'dynamic-image'
            })
            continue
          }
        }
        if (imagePath.includes('\\')) {
          result.push({
            level: 'warning',
            file: ref.file,
            offset: ref.location.offset,
            length: ref.location.length,
            type: 'image-path-back-slash'
          })
          imagePath = imagePath.replaceAll('\\', '/') as ImageRelativePath
        }
        if (imagePath.startsWith('./')) {
          result.push({
            level: 'warning',
            file: ref.file,
            offset: ref.location.offset,
            length: ref.location.length,
            type: 'image-path-dot-slash'
          })
          imagePath = imagePath.replace('./', '') as ImageRelativePath
        }
        if (bundle.maa && !imagePath.endsWith('.png')) {
          result.push({
            level: 'warning',
            file: ref.file,
            offset: ref.location.offset,
            length: ref.location.length,
            type: 'image-path-missing-png'
          })
          imagePath = (imagePath + '.png') as ImageRelativePath
        }
        if (isFolder) {
          continue
        }
        if (!images.has(imagePath)) {
          let found = false
          if (bundle.maa) {
            const suffix = '/' + imagePath
            for (const image of images) {
              if (image.endsWith(suffix)) {
                found = true
                break
              }
            }
          }
          if (!found) {
            result.push({
              level: 'error',
              file: ref.file,
              offset: ref.location.offset,
              length: ref.location.length,
              type: 'unknown-image',
              image: ref.target
            })
          }
        }
      } else if (isAnchorRef(ref)) {
        if (!anchors.has(ref.target as string as AnchorName)) {
          result.push({
            level: 'error',
            file: ref.file,
            offset: ref.location.offset + ref.attrs.offset + 1,
            length: ref.location.length - ref.attrs.offset - 2,
            type: 'unknown-anchor',
            anchor: ref.target
          })
        }
      } else if (ref.type === 'task.locale') {
        const infos = bundle.langBundle.queryKey(ref.target)
        if (!infos.find(info => !!info)) {
          result.push({
            level: 'error',
            file: ref.file,
            offset: ref.location.offset,
            length: ref.location.length,
            type: 'unknown-locale',
            locale: ref.target
          })
        } else {
          const missingLangs: string[] = []
          for (const [idx, info] of infos.entries()) {
            if (!info) {
              missingLangs.push(bundle.langBundle.langs[idx].name)
            }
          }
          if (missingLangs.length > 0) {
            result.push({
              level: 'error',
              file: ref.file,
              offset: ref.location.offset,
              length: ref.location.length,
              type: 'missing-locale',
              locale: ref.target,
              langs: missingLangs
            })
          }
        }
      }
      if (
        (ref.type === 'task.next' || ref.type === 'task.roi' || ref.type === 'task.target') &&
        ref.attrs.unknown.length > 0
      ) {
        for (const [attr, offset, length] of ref.attrs.unknown) {
          result.push({
            level: 'error',
            file: ref.file,
            offset: ref.location.offset + 2 + offset,
            length: length - 2,
            type: 'unknown-attr',
            attr: attr
          })
        }
      }
    }
  }

  return result
}
