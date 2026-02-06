import { t } from '@mse/locale'

import type { InterfaceBundle } from '../interface/interface'
import type { TaskRefInfo } from '../parser/task/task'
import { extractTaskRef } from '../utils/helper'
import {
  type AbsolutePath,
  type AnchorName,
  type ImageRelativePath,
  type TaskName,
  relativePath
} from '../utils/types'

export type Diagnostic = {
  level: 'warning' | 'error'
  file: AbsolutePath
  offset: number
  length: number
} & (
  | {
      type: 'conflict-task'
      task: string
      previous: {
        file: AbsolutePath
        offset: number
        length: number
      }
    }
  | {
      type: 'duplicate-next'
      task: string
    }
  | {
      type: 'unknown-task'
      task: string
    }
  | {
      type: 'dynamic-image'
    }
  | {
      type: 'image-path-back-slash'
    }
  | {
      type: 'image-path-dot-slash'
    }
  | {
      type: 'image-path-missing-png' // maa only
    }
  | {
      type: 'unknown-image'
      image: string
    }
  | {
      type: 'unknown-anchor'
      anchor: string
    }
  | {
      type: 'unknown-attr'
      attr: string
    }
  | {
      type: 'int-conflict-controller'
      ctrl: string
      previous: {
        file: AbsolutePath
        offset: number
        length: number
      }
    }
  | {
      type: 'int-unknown-controller'
      ctrl: string
    }
  | {
      type: 'int-conflict-resource'
      res: string
      previous: {
        file: AbsolutePath
        offset: number
        length: number
      }
    }
  | {
      type: 'int-unknown-resource'
      res: string
    }
  | {
      type: 'int-conflict-option'
      option: string
      previous: {
        file: AbsolutePath
        offset: number
        length: number
      }
    }
  | {
      type: 'int-unknown-option'
      option: string
    }
  | {
      type: 'int-conflict-case'
      option: string
      case: string
      previous: {
        file: AbsolutePath
        offset: number
        length: number
      }
    }
  | {
      type: 'int-unknown-case'
      option: string
      case: string
    }
  | {
      type: 'int-switch-name-invalid'
    }
  | {
      type: 'int-switch-missing'
      option: string
      missingYes: boolean
      missingNo: boolean
    }
  | {
      type: 'int-switch-should-fixed'
    }
  | {
      type: 'int-unknown-entry-task'
      task: string
    }
  | {
      type: 'int-override-unknown-task'
      task: string
    }
)

function checkInterface<T>(bundle: InterfaceBundle<T>): Diagnostic[] {
  const result: Diagnostic[] = []

  const layer = bundle.topLayer
  if (layer.type === 'interface') {
    const realTasks = new Set(layer.parent?.getTaskListNotUnique() ?? [])

    for (const ref of layer.mergedRefs) {
      if (ref.type === 'task.entry') {
        if (!realTasks.has(ref.target)) {
          result.push({
            level: 'error',
            file: ref.file,
            offset: ref.location.offset,
            length: ref.location.length,
            type: 'int-unknown-entry-task',
            task: ref.target
          })
        }
      }
    }

    for (const decl of layer.mergedDecls) {
      if (decl.type === 'task.decl') {
        if (!realTasks.has(decl.task)) {
          result.push({
            level: 'error',
            file: decl.file,
            offset: decl.location.offset,
            length: decl.location.length,
            type: 'int-override-unknown-task',
            task: decl.task
          })
        }
      }
    }
  }

  const ctrlDecls = bundle.info.decls.filter(decl => decl.type === 'interface.controller')
  const ctrls = new Map<string, (typeof ctrlDecls)[number]>()
  for (const decl of ctrlDecls) {
    if (ctrls.has(decl.name)) {
      const prev = ctrls.get(decl.name)!
      result.push({
        level: 'error',
        file: decl.file,
        offset: decl.location.offset,
        length: decl.location.length,
        type: 'int-conflict-controller',
        ctrl: decl.name,
        previous: {
          file: prev.file,
          offset: prev.location.offset,
          length: prev.location.length
        }
      })
    } else {
      ctrls.set(decl.name, decl)
    }
  }

  const resDecls = bundle.info.decls.filter(decl => decl.type === 'interface.resource')
  const ress = new Map<string, (typeof resDecls)[number]>()
  for (const decl of resDecls) {
    if (ress.has(decl.name)) {
      const prev = ress.get(decl.name)!
      result.push({
        level: 'error',
        file: decl.file,
        offset: decl.location.offset,
        length: decl.location.length,
        type: 'int-conflict-resource',
        res: decl.name,
        previous: {
          file: prev.file,
          offset: prev.location.offset,
          length: prev.location.length
        }
      })
    } else {
      ress.set(decl.name, decl)
    }
  }

  const optDecls = bundle.info.decls.filter(decl => decl.type === 'interface.option')
  const options = new Map<string, (typeof optDecls)[number]>()
  for (const decl of optDecls) {
    if (options.has(decl.name)) {
      const prev = options.get(decl.name)!
      result.push({
        level: 'error',
        file: decl.file,
        offset: decl.location.offset,
        length: decl.location.length,
        type: 'int-conflict-option',
        option: decl.name,
        previous: {
          file: prev.file,
          offset: prev.location.offset,
          length: prev.location.length
        }
      })
    } else {
      options.set(decl.name, decl)

      if (!decl.optionType || decl.optionType === 'select' || decl.optionType === 'switch') {
        const caseDecls = bundle.info.decls.filter(
          decl2 => decl2.type === 'interface.case' && decl2.option === decl.name
        )
        const cases = new Map<string, (typeof caseDecls)[number]>()
        for (const decl2 of caseDecls) {
          if (cases.has(decl2.name)) {
            const prev = cases.get(decl2.name)!
            result.push({
              level: 'error',
              file: decl2.file,
              offset: decl2.location.offset,
              length: decl2.location.length,
              type: 'int-conflict-case',
              option: decl.name,
              case: decl2.name,
              previous: {
                file: prev.file,
                offset: prev.location.offset,
                length: prev.location.length
              }
            })
          } else {
            cases.set(decl2.name, decl2)
          }
        }

        const caseRefs = bundle.info.refs
          .filter(ref => ref.type === 'interface.case')
          .filter(ref => ref.option === decl.name)
        for (const ref of caseRefs) {
          if (!cases.has(ref.target)) {
            result.push({
              level: 'error',
              file: ref.file,
              offset: ref.location.offset,
              length: ref.location.length,
              type: 'int-unknown-case',
              option: decl.name,
              case: ref.target
            })
          }
        }

        if (decl.optionType === 'switch') {
          let missingYes = true
          let missingNo = true
          for (const [name, decl2] of cases) {
            if (name === 'Yes') {
              missingYes = false
            } else if (name === 'No') {
              missingNo = false
            } else if (name.toLowerCase() === 'yes') {
              missingYes = false
              result.push({
                level: 'warning',
                file: decl2.file,
                offset: decl2.location.offset,
                length: decl2.location.length,
                type: 'int-switch-should-fixed'
              })
            } else if (name.toLowerCase() === 'no') {
              missingNo = false
              result.push({
                level: 'warning',
                file: decl2.file,
                offset: decl2.location.offset,
                length: decl2.location.length,
                type: 'int-switch-should-fixed'
              })
            } else {
              result.push({
                level: 'error',
                file: decl2.file,
                offset: decl2.location.offset,
                length: decl2.location.length,
                type: 'int-switch-name-invalid'
              })
            }
          }
          if (missingYes || missingNo) {
            result.push({
              level: 'error',
              file: decl.file,
              offset: decl.location.offset,
              length: decl.location.length,
              type: 'int-switch-missing',
              option: decl.name,
              missingYes,
              missingNo
            })
          }
        }
      }
    }
  }

  for (const ref of bundle.info.refs) {
    if (ref.type === 'interface.controller') {
      if (!ctrls.has(ref.target)) {
        result.push({
          level: 'error',
          file: ref.file,
          offset: ref.location.offset,
          length: ref.location.length,
          type: 'int-unknown-controller',
          ctrl: ref.target
        })
      }
    } else if (ref.type === 'interface.resource') {
      if (!ctrls.has(ref.target)) {
        result.push({
          level: 'error',
          file: ref.file,
          offset: ref.location.offset,
          length: ref.location.length,
          type: 'int-unknown-resource',
          res: ref.target
        })
      }
    } else if (ref.type === 'interface.option') {
      if (!options.has(ref.target)) {
        result.push({
          level: 'error',
          file: ref.file,
          offset: ref.location.offset,
          length: ref.location.length,
          type: 'int-unknown-option',
          option: ref.target
        })
      }
    }
  }

  return result
}

export function performDiagnostic<T>(bundle: InterfaceBundle<T>): Diagnostic[] {
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

  result.push(...checkInterface(bundle))

  return result
}

type Position = [line: number, column: number]

export async function buildDiagnosticMessage(
  root: AbsolutePath,
  diag: Diagnostic,
  evalPos: (file: AbsolutePath, offset: number) => Promise<Position>
): Promise<[start: Position, end: Position, brief: string]> {
  const buildPos = async (loc: { file: AbsolutePath; offset: number }) => {
    const [line, column] = await evalPos(loc.file, loc.offset)
    return `${relativePath(root, loc.file)}:${line}:${column}`
  }

  const start = await evalPos(diag.file, diag.offset)
  const end = await evalPos(diag.file, diag.offset + diag.length)

  const buildBrief = async () => {
    switch (diag.type) {
      case 'conflict-task':
        return t('maa.pipeline.error.conflict-task', diag.task, await buildPos(diag.previous))
      case 'duplicate-next':
        return t('maa.pipeline.error.duplicate-next', diag.task)
      case 'unknown-task':
        return t('maa.pipeline.error.unknown-task', diag.task)
      case 'dynamic-image':
        return t('maa.pipeline.warning.image-path-dynamic')
      case 'image-path-back-slash':
        return t('maa.pipeline.warning.image-path-backslash')
      case 'image-path-dot-slash':
        return t('maa.pipeline.warning.image-path-dot-slash')
      case 'image-path-missing-png':
        return t('maa.pipeline.warning.image-path-missing-png')
      case 'unknown-image':
        return t('maa.pipeline.error.unknown-image', diag.image)
      case 'unknown-anchor':
        return t('maa.pipeline.error.unknown-anchor', diag.anchor)
      case 'unknown-attr':
        return t('maa.pipeline.error.unknown-attr', diag.attr)
      case 'int-conflict-controller':
        return t('maa.pipeline.error.conflict-controller', diag.ctrl, await buildPos(diag.previous))
      case 'int-unknown-controller':
        return t('maa.pipeline.error.unknown-controller', diag.ctrl)
      case 'int-conflict-resource':
        return t('maa.pipeline.error.conflict-resource', diag.res, await buildPos(diag.previous))
      case 'int-unknown-resource':
        return t('maa.pipeline.error.unknown-resource', diag.res)
      case 'int-conflict-option':
        return t('maa.pipeline.error.conflict-option', diag.option, await buildPos(diag.previous))
      case 'int-unknown-option':
        return t('maa.pipeline.error.unknown-option', diag.option)
      case 'int-conflict-case':
        return t(
          'maa.pipeline.error.conflict-case',
          diag.case,
          diag.option,
          await buildPos(diag.previous)
        )
      case 'int-unknown-case':
        return t('maa.pipeline.error.unknown-case', diag.case, diag.option)
      case 'int-switch-name-invalid':
        return t('maa.pipeline.error.switch-name-invalid')
      case 'int-switch-missing':
        if (diag.missingYes && diag.missingNo) {
          return t('maa.pipeline.error.switch-missing-all')
        } else if (diag.missingYes) {
          return t('maa.pipeline.error.switch-missing-yes')
        } else {
          return t('maa.pipeline.error.switch-missing-no')
        }
      case 'int-switch-should-fixed':
        return t('maa.pipeline.warning.switch-name-should-fixed')
      case 'int-unknown-entry-task':
        return t('maa.pipeline.error.unknown-entry-task', diag.task)
      case 'int-override-unknown-task':
        return t('maa.pipeline.error.override-unknown-task', diag.task)
    }
    return `unknown diagnostic: ${JSON.stringify(diag)}`
  }

  return [start, end, await buildBrief()]
}
