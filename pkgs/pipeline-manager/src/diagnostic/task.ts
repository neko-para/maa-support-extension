import type { InterfaceBundle } from '../interface/interface'
import type { TaskRefInfo } from '../parser/task/task'
import { extractTaskRef } from '../utils/helper'
import type { AnchorName, ImageRelativePath, TaskName } from '../utils/types'
import type { Diagnostic } from './types'

export function checkTask<T>(bundle: InterfaceBundle<T>): Diagnostic[] {
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
            ref => ref.type === 'task.next' && !ref.anchor
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

    const refs = layer.mergedRefs
    const tasks = new Set(layer.getTaskListNotUnique())
    const anchors = new Set(layer.getAnchorList().map(([anchor]) => anchor))
    const images = new Set(layer.getImageListNotUnique())
    for (const ref of refs) {
      const task = extractTaskRef(ref)
      if (task) {
        if (!tasks.has(task)) {
          let offset = ref.location.offset
          let length = ref.location.length
          if (ref.type === 'task.next' && typeof ref.offset === 'number') {
            offset = ref.location.offset + ref.offset + 1
            length = ref.location.length - ref.offset - 2
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
      } else if (ref.type === 'task.template') {
        let imagePath = ref.target
        if (!bundle.maa && !imagePath.endsWith('.png')) {
          result.push({
            level: 'warning',
            file: ref.file,
            offset: ref.location.offset,
            length: ref.location.length,
            type: 'dynamic-image'
          })
          continue
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
      } else if (ref.type === 'task.next' && ref.anchor) {
        if (!anchors.has(ref.target as string as AnchorName)) {
          result.push({
            level: 'error',
            file: ref.file,
            offset: ref.location.offset,
            length: ref.location.length,
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
      if (ref.type === 'task.next' && ref.unknown && ref.unknown.length > 0) {
        for (const [attr, offset, length] of ref.unknown) {
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
