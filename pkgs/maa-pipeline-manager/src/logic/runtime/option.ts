import { t } from '@nekosu/maa-locale'

import type {
  CheckboxConfig,
  CheckboxOption,
  ControllerRuntimeBase,
  InputConfig,
  Interface,
  ResourceRuntime,
  SelectConfig,
  SelectOption,
  SwitchOption,
  TaskConfig
} from '../types'

export type OptionTrace = {
  name: string
  from: 'global' | 'controller' | 'resource' | 'task' | 'option' | 'preset'
  origin: string
}

function isStringArray(arr?: unknown): arr is string[] {
  return Array.isArray(arr) && !arr.find(x => typeof x !== 'string')
}

function isStringStringObject(obj?: unknown): obj is Record<string, string> {
  return (
    typeof obj === 'object' && obj !== null && !Object.values(obj).find(x => typeof x !== 'string')
  )
}

export function resolveOptionConfig(
  task: TaskConfig,
  option: string,
  type: 'select' | 'switch'
): SelectConfig | undefined
export function resolveOptionConfig(
  task: TaskConfig,
  option: string,
  type: 'checkbox'
): CheckboxConfig | undefined
export function resolveOptionConfig(
  task: TaskConfig,
  option: string,
  type: 'input'
): InputConfig | undefined
export function resolveOptionConfig(
  task: TaskConfig,
  option: string,
  type: 'select' | 'checkbox' | 'input' | 'switch'
) {
  const val = task.option?.[option]
  switch (type) {
    case 'select':
    case 'switch':
      return typeof val === 'string' ? val : undefined

    case 'checkbox':
      return isStringArray(val) ? val : undefined

    case 'input':
      return isStringStringObject(val) ? val : undefined
  }
}

export function resolveSelect(
  task: TaskConfig,
  option: string,
  optMeta: SelectOption | SwitchOption
) {
  const cfg =
    resolveOptionConfig(task, option, 'select') ?? optMeta.default_case ?? optMeta.cases?.[0].name
  if (!cfg) {
    return null
  }

  return optMeta.cases?.find(x => x.name === cfg) ?? null
}

export function resolveCheckbox(task: TaskConfig, option: string, optMeta: CheckboxOption) {
  const cfg = resolveOptionConfig(task, option, 'checkbox') ?? []
  return optMeta.cases?.filter(x => cfg.includes(x.name)) ?? null
}

export function buildOption(
  data: Interface,
  task: TaskConfig,
  ctrlRt: ControllerRuntimeBase,
  resRt: ResourceRuntime
): OptionTrace[] | string {
  const taskInfo = data.task?.find(x => x.name === task.name)

  if (!taskInfo) {
    return t('maa.pi.error.cannot-find-task', task.name)
  }

  const pending: OptionTrace[] = []

  for (const opt of data.global_option ?? []) {
    pending.push({
      name: opt,
      from: 'global',
      origin: ''
    })
  }

  for (const opt of ctrlRt.option ?? []) {
    pending.push({
      name: opt,
      from: 'controller',
      origin: ctrlRt.name
    })
  }

  for (const opt of resRt.option ?? []) {
    pending.push({
      name: opt,
      from: 'resource',
      origin: resRt.name
    })
  }

  for (const opt of taskInfo.option ?? []) {
    pending.push({
      name: opt,
      from: 'task',
      origin: taskInfo.name
    })
  }

  const resolved: OptionTrace[] = []
  const resolvedOption = new Set<string>()

  while (pending.length > 0) {
    const opt = pending.shift()!
    if (resolvedOption.has(opt.name)) {
      continue
    }
    resolved.push(opt)
    resolvedOption.add(opt.name)

    const optMeta = data.option?.[opt.name]
    if (!optMeta) {
      return t('maa.pi.error.cannot-find-option-from', opt.name, opt.from, opt.origin)
    }

    if (
      ctrlRt.name !== '$fixed' &&
      optMeta.controller &&
      !optMeta.controller.includes(ctrlRt.name)
    ) {
      continue
    }

    if (optMeta.resource && !optMeta.resource.includes(resRt.name)) {
      continue
    }

    if (!optMeta.type || optMeta.type === 'select' || optMeta.type === 'switch') {
      const caseMeta = resolveSelect(task, opt.name, optMeta)
      if (!caseMeta) {
        return t('maa.pi.error.cannot-resolve-option', opt.name)
      }
      for (const sub of caseMeta.option ?? []) {
        pending.push({
          name: sub,
          from: 'option',
          origin: opt.name
        })
      }
    } else if (optMeta.type === 'checkbox') {
      const caseMetas = resolveCheckbox(task, opt.name, optMeta)
      if (!caseMetas) {
        return t('maa.pi.error.cannot-resolve-option', opt.name)
      }
      for (const caseMeta of caseMetas) {
        for (const sub of caseMeta.option ?? []) {
          pending.push({
            name: sub,
            from: 'option',
            origin: opt.name
          })
        }
      }
    }
  }

  return resolved
}
