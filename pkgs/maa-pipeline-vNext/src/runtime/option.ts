import { t } from '@nekosu/maa-locale'

import type {
  CheckboxOption,
  ParsedInterface,
  SelectOption,
  SwitchOption
} from '../interface/types'
import type {
  CheckboxConfig,
  ControllerRuntimeBase,
  InputConfig,
  ResolvedOption,
  ResourceRuntime,
  SelectConfig,
  TaskConfig
} from './types'

type OptWithCases = SelectOption | SwitchOption | CheckboxOption
type SelectOrSwitchOpt = SelectOption | SwitchOption

type CaseObj = { option?: string[]; pipeline_override?: unknown }

function isStringArray(arr?: unknown): arr is string[] {
  return Array.isArray(arr) && !arr.find(x => typeof x !== 'string')
}

function isStringStringObject(obj?: unknown): obj is Record<string, string> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    !Array.isArray(obj) &&
    !Object.values(obj).find(x => typeof x !== 'string')
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

export function resolveSelect(task: TaskConfig, option: string, optMeta: SelectOrSwitchOpt) {
  const firstCase = Object.keys(optMeta.cases ?? {})[0]
  const cfg = resolveOptionConfig(task, option, 'select') ?? optMeta.default_case ?? firstCase
  if (!cfg) {
    return null
  }

  return ((optMeta.cases ?? {}) as Record<string, CaseObj>)[cfg] ?? null
}

export function resolveCheckbox(task: TaskConfig, option: string, optMeta: OptWithCases) {
  const cfg = resolveOptionConfig(task, option, 'checkbox') ?? []
  const cases = (optMeta.cases ?? {}) as Record<string, CaseObj>
  return Object.entries(cases)
    .filter(([name]) => cfg.includes(name))
    .map(([, c]) => c)
}

/**
 * 解析选项依赖链。从 global → controller → resource → task → option（递归），
 * 收集所有被激活的选项并返回解析顺序。
 */
export function buildOption(
  data: ParsedInterface,
  task: TaskConfig,
  ctrlRt: ControllerRuntimeBase,
  resRt: ResourceRuntime
): ResolvedOption[] | string {
  const taskInfo = data.task[task.name]

  if (!taskInfo) {
    return t('maa.pi.error.cannot-find-task', task.name)
  }

  const pending: ResolvedOption[] = []

  for (const opt of data.global_option ?? []) {
    pending.push({ name: opt, from: 'global', origin: '' })
  }

  for (const opt of ctrlRt.option ?? []) {
    pending.push({ name: opt, from: 'controller', origin: ctrlRt.name })
  }

  for (const opt of resRt.option ?? []) {
    pending.push({ name: opt, from: 'resource', origin: resRt.name })
  }

  for (const opt of taskInfo.option ?? []) {
    pending.push({ name: opt, from: 'task', origin: task.name })
  }

  const resolved: ResolvedOption[] = []
  const resolvedOption = new Set<string>()

  while (pending.length > 0) {
    const opt = pending.shift()!
    if (resolvedOption.has(opt.name)) {
      continue
    }
    resolved.push(opt)
    resolvedOption.add(opt.name)

    const optMeta = data.option[opt.name]
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
        pending.push({ name: sub, from: 'option', origin: opt.name })
      }
    } else if (optMeta.type === 'checkbox') {
      const caseMetas = resolveCheckbox(task, opt.name, optMeta)
      for (const caseMeta of caseMetas) {
        for (const sub of caseMeta.option ?? []) {
          pending.push({ name: sub, from: 'option', origin: opt.name })
        }
      }
    }
  }

  return resolved
}
