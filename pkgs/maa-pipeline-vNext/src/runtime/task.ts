import { t } from '@nekosu/maa-locale'

import type { ParsedInterface } from '../interface/types'
import { buildOption, resolveCheckbox, resolveOptionConfig, resolveSelect } from './option'
import type {
  ControllerRuntime,
  ControllerRuntimeBase,
  InterfaceConfig,
  ResourceRuntime,
  TaskConfig,
  TaskRuntime
} from './types'

type InputItemType = 'string' | 'int' | 'bool'

function buildTask(
  data: ParsedInterface,
  task: TaskConfig,
  ctrlRt: ControllerRuntimeBase,
  resRt: ResourceRuntime
): unknown[] | string {
  const taskMeta = data.task[task.name]

  const overrides: unknown[] = [taskMeta?.pipeline_override ?? {}]

  const options = buildOption(data, task, ctrlRt, resRt)
  if (typeof options === 'string') {
    return options
  }

  for (const opt of options) {
    const optMeta = data.option[opt.name]
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
      for (const caseMeta of caseMetas) {
        if (caseMeta?.pipeline_override) {
          overrides.push(caseMeta.pipeline_override)
        }
      }
    } else if (optMeta.type === 'input') {
      const vals = resolveOptionConfig(task, opt.name, 'input') ?? {}
      const inputs = (optMeta.inputs ?? {}) as Record<
        string,
        { name?: string; default?: string; pipeline_type?: InputItemType }
      >

      const updateOverride = (v: unknown): unknown => {
        if (Array.isArray(v)) {
          return v.map(updateOverride)
        } else if (typeof v === 'object' && v !== null) {
          const obj = v as Record<string, unknown>
          return Object.fromEntries(
            Object.entries(obj).map(([key, val]) => [key, updateOverride(val)])
          )
        } else if (typeof v === 'string') {
          let finalType: InputItemType | undefined = undefined
          let result = v
          for (const [subName, subOpt] of Object.entries(inputs)) {
            const idx = result.indexOf(`{${subName}}`)
            if (idx !== -1) {
              const expectType = subOpt.pipeline_type ?? 'string'
              if (finalType && finalType !== expectType) {
                throw 'input type mismatch!'
              }
              finalType = expectType
              result = result.replaceAll(`{${subName}}`, vals[subName] ?? subOpt.default ?? '')
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
          return v
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

/**
 * 构建 TaskRuntime——遍历配置的任务列表，为每个任务解析 pipeline_override。
 */
export function buildTaskRuntime(
  data: ParsedInterface,
  config: InterfaceConfig,
  ctrlRt: ControllerRuntime,
  resRt: ResourceRuntime
): TaskRuntime | string {
  const tasks: TaskRuntime['tasks'] = []
  for (const task of config.task ?? []) {
    const taskInfo = data.task[task.name]
    if (!taskInfo) {
      return t('maa.pi.error.cannot-find-task', task.name)
    }

    const info = buildTask(data, task, ctrlRt, resRt)
    if (typeof info === 'string') {
      return info
    }
    tasks.push({
      name: task.name,
      entry: taskInfo.entry,
      pipeline_override: info
    })
  }

  return { tasks }
}
