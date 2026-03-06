import { t } from '@nekosu/maa-locale'

import type {
  ControllerRuntime,
  InputItemType,
  Interface,
  InterfaceConfig,
  ResourceRuntime,
  TaskConfig,
  TaskRuntime
} from '../types'
import { buildOption, resolveCheckbox, resolveOptionConfig, resolveSelect } from './option'

export function buildTask(
  data: Interface,
  task: TaskConfig,
  ctrlRt: ControllerRuntime,
  resRt: ResourceRuntime
): unknown[] | string {
  const overrides: unknown[] = []

  const options = buildOption(data, task, ctrlRt, resRt)
  if (typeof options === 'string') {
    return options
  }

  for (const opt of options) {
    const optMeta = data.option?.[opt.name]
    if (!optMeta) {
      return t('maa.pi.error.cannot-find-option-from', opt.name, opt.from, opt.origin)
    }

    if (!optMeta.type || optMeta.type === 'select' || optMeta.type === 'switch') {
      const caseMeta = resolveSelect(task, opt.name, optMeta)
      if (caseMeta?.pipeline_override) {
        overrides.push(caseMeta.pipeline_override)
      }
    } else if (optMeta.type === 'checkbox') {
      const caseMetas = resolveCheckbox(task, opt.name, optMeta)
      for (const caseMeta of caseMetas ?? []) {
        if (caseMeta?.pipeline_override) {
          overrides.push(caseMeta.pipeline_override)
        }
      }
    } else if (optMeta.type === 'input') {
      // no verify

      const vals = resolveOptionConfig(task, opt.name, 'input') ?? {}

      const updateOverride = (v: unknown): unknown => {
        if (Array.isArray(v)) {
          return v.map(updateOverride)
        } else if (typeof v === 'object' && v !== null) {
          const obj = v as Record<string, unknown>
          return Object.fromEntries(
            Object.entries(obj).map(([key, val]) => {
              return [key, updateOverride(val)] as [string, unknown]
            })
          )
        } else if (typeof v === 'string') {
          let finalType: InputItemType | undefined = undefined
          let result = v
          for (const subOpt of optMeta.inputs ?? []) {
            const idx = result.indexOf(`{${subOpt.name}}`)
            if (idx !== -1) {
              const expectType = subOpt.pipeline_type ?? 'string'
              if (finalType && finalType !== expectType) {
                throw 'input type mismatch!'
              }
              finalType = expectType
              result = result.replaceAll(`{${subOpt.name}}`, vals[subOpt.name]!)
            }
          }
          switch (finalType) {
            case 'string':
              return result
            case 'int':
              return parseInt(result)
            case 'bool':
              return result === 'true'
          }
          return ''
        } else {
          return v
        }
      }

      try {
        overrides.push(updateOverride(optMeta.pipeline_override ?? {}))
      } catch (err) {
        return `${err}`
      }
    }
  }

  return overrides
}

export function buildTaskRuntime(
  data: Interface,
  config: InterfaceConfig,
  ctrlRt: ControllerRuntime,
  resRt: ResourceRuntime
): TaskRuntime | string {
  const taskRt: TaskRuntime = {
    tasks: []
  }
  for (const task of config.task ?? []) {
    const taskInfo = data.task?.find(x => x.name === task.name)
    if (!taskInfo) {
      return t('maa.pi.error.cannot-find-task', task.name)
    }

    const info = buildTask(data, task, ctrlRt, resRt)
    if (typeof info === 'string') {
      return info
    }
    taskRt.tasks.push({
      name: task.name,
      entry: taskInfo.entry,
      pipeline_override: info
    })
  }

  return taskRt
}
