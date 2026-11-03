import * as path from 'node:path'

import type { LocaleType } from '@nekosu/maa-locale'

import pkg from '../../package.json'
import type { TestAgentConfig, TestAgentSetting } from '../types/config'

/** interface.json 顶层 agent 声明的有效字段。 */
export type AgentDeclaration = {
  child_exec?: string
  child_args?: string[]
  identifier?: string
}

/** 交给 worker 启动的 agent，已经解析为绝对路径并合并好环境变量。 */
export type ResolvedAgentConfig = {
  childExec: string
  childArgs: string[]
  cwd: string
  env: Record<string, string>
  identifier?: string
  connectTimeoutMs: number
  timeoutMs: number
}

/** 某个 custom 识别名被哪些待测节点（含 And/Or 节点名引用后的根节点）引用。 */
export type CustomRecognitionRequirement = {
  name: string
  nodes: string[]
}

export const AGENTS_ENV = 'MAATOOLS_AGENTS'
export const PLANNED_NODES_ENV = 'MAATOOLS_NODES'

export const DEFAULT_AGENT_CONNECT_TIMEOUT_MS = 30_000
/** 未显式配置时使用 60s 的父侧 watchdog；MaaFW 的 IPC 超时会表现为识别未命中，不能当默认值。 */
export const DEFAULT_AGENT_TIMEOUT_MS = 0
/** setTimeout/native timeout 能可靠接受的上限。 */
const MAX_TIMEOUT_MS = 2_147_483_647

/** 工具在 PI 协议里的客户端标识，对应 extension 的 VsCode。 */
const PI_CLIENT_NAME = 'MaaTools'

/** 本工具实现了 PI v2.5.0 约定的 agent 子进程环境变量。 */
const PI_INTERFACE_VERSION = 'v2.5.0'

const LOCALE_LANGUAGES: Record<LocaleType, string> = {
  zh: 'zh_cn',
  en: 'en_us'
}

export type TestAgentEnvOptions = {
  locale?: LocaleType
  maafwVersion: string
  interfaceVersion?: string
}

/**
 * PI v2.5.0 约定的 agent 子进程环境变量。
 * 只注入客户端自身与接口版本这类客观值；PI_CONTROLLER / PI_RESOURCE 描述真实 UI 选择，
 * 测试没有真实选择，因此不注入，需要时由 test.agent[].env 显式提供。
 */
export function buildTestAgentEnv(options: TestAgentEnvOptions): Record<string, string> {
  return {
    PI_INTERFACE_VERSION,
    PI_CLIENT_NAME,
    PI_CLIENT_VERSION: pkg.version,
    PI_CLIENT_LANGUAGE: LOCALE_LANGUAGES[options.locale ?? 'zh'],
    PI_CLIENT_MAAFW_VERSION: options.maafwVersion,
    PI_VERSION: options.interfaceVersion ?? ''
  }
}

export type ResolveTestAgentsOptions = {
  setting?: TestAgentSetting
  interfaceAgents?: AgentDeclaration[]
  interfaceRoot?: string
  cwd: string
  baseEnv: Record<string, string>
}

export type ResolveTestAgentsResult = {
  agents: ResolvedAgentConfig[]
  error?: string
}

function isBareCommand(command: string) {
  return (
    !path.isAbsolute(command) &&
    !command.includes('/') &&
    !command.includes('\\') &&
    !command.startsWith('.')
  )
}

function resolveCommand(command: string, root: string) {
  return isBareCommand(command) ? command : path.resolve(root, command)
}

/** interface.json / 配置里的 `{PROJECT_DIR}` 相对当前解析根展开。 */
function expandProjectDir(value: string, root: string) {
  return value.replaceAll('{PROJECT_DIR}', root)
}

function normalizeTimeout(
  value: number | undefined,
  fallback: number,
  minimum: number,
  field: string,
  errors: string[]
) {
  if (value === undefined) {
    return fallback
  }
  if (!Number.isSafeInteger(value) || value < minimum || value > MAX_TIMEOUT_MS) {
    errors.push(`${field} 必须是 ${minimum} 到 ${MAX_TIMEOUT_MS} 之间的安全整数`)
    return fallback
  }
  return value
}

/**
 * 按 `test.agent` 与 interface.json 声明解析 agent 列表。
 * 显式配置覆盖 interface；两者相对路径的解析根分别是 cwd 和 interface 目录。
 */
export function resolveTestAgents(options: ResolveTestAgentsOptions): ResolveTestAgentsResult {
  if (options.setting === null) {
    return { agents: [], error: 'test.agent 不能为 null；用 false 关闭，或省略以读取 interface' }
  }
  const setting = options.setting ?? 'interface'
  if (setting === false) {
    return { agents: [] }
  }
  if (setting !== 'interface' && typeof setting !== 'object') {
    return { agents: [], error: 'test.agent 必须是 "interface"、false、对象或对象数组' }
  }

  const fromInterface = setting === 'interface'
  const declarations: AgentDeclaration[] = fromInterface
    ? (options.interfaceAgents ?? [])
    : Array.isArray(setting)
      ? setting
      : [setting]
  const root = path.resolve(fromInterface ? (options.interfaceRoot ?? options.cwd) : options.cwd)
  const errors: string[] = []
  const agents: ResolvedAgentConfig[] = []

  declarations.forEach((declaration, index) => {
    const label = fromInterface ? `interface.json agent[${index}]` : `test.agent[${index}]`
    const childExecValue = declaration?.child_exec
    if (typeof childExecValue !== 'string' || childExecValue.trim() === '') {
      // interface 里可能残留没有 child_exec 的声明，与 extension 一致地忽略。
      if (!fromInterface) {
        errors.push(`${label} 缺少 child_exec`)
      }
      return
    }

    const childArgs = declaration.child_args
    if (
      childArgs !== undefined &&
      (!Array.isArray(childArgs) || childArgs.some(arg => typeof arg !== 'string'))
    ) {
      errors.push(`${label}.child_args 必须是字符串数组`)
      return
    }

    const agentDeclaration = declaration as TestAgentConfig
    const cwdValue = agentDeclaration.cwd
    if (cwdValue !== undefined && typeof cwdValue !== 'string') {
      errors.push(`${label}.cwd 必须是字符串`)
      return
    }

    const envValue = agentDeclaration.env
    if (
      envValue !== undefined &&
      (envValue === null ||
        typeof envValue !== 'object' ||
        Array.isArray(envValue) ||
        Object.values(envValue).some(value => typeof value !== 'string'))
    ) {
      errors.push(`${label}.env 必须是字符串到字符串的对象`)
      return
    }

    const identifierValue = agentDeclaration.identifier
    if (identifierValue !== undefined && typeof identifierValue !== 'string') {
      errors.push(`${label}.identifier 必须是字符串`)
      return
    }

    const connectTimeoutMs = normalizeTimeout(
      agentDeclaration.connectTimeoutMs,
      DEFAULT_AGENT_CONNECT_TIMEOUT_MS,
      1,
      `${label}.connectTimeoutMs`,
      errors
    )
    const timeoutMs = normalizeTimeout(
      agentDeclaration.timeoutMs,
      DEFAULT_AGENT_TIMEOUT_MS,
      0,
      `${label}.timeoutMs`,
      errors
    )

    agents.push({
      childExec: resolveCommand(expandProjectDir(childExecValue, root), root),
      childArgs: (childArgs ?? []).map(arg => expandProjectDir(arg, root)),
      cwd: cwdValue ? path.resolve(options.cwd, expandProjectDir(cwdValue, root)) : root,
      env: { ...options.baseEnv, ...(envValue ?? {}) },
      identifier: identifierValue,
      connectTimeoutMs,
      timeoutMs
    })
  })

  return errors.length > 0 ? { agents: [], error: errors.join('；') } : { agents }
}

/** 遍历 recognition 值（原始 pipeline JSON 或有效节点定义），遇到节点名引用时回调。 */
function visitRecognition(
  value: unknown,
  resolveNode: (node: string) => string[],
  inlineOnly = false
): string[] {
  if (!value || typeof value !== 'object') {
    return []
  }
  const node = value as { recognition?: unknown; custom_recognition?: unknown; type?: unknown }
  // 5.13 的有效定义是 recognition: {type, param}；5.12.x 的 And/Or 内联子项是
  // {type, param, sub_name} 平铺，必须同时兼容，否则会漏检 Custom。
  const recognition =
    node.recognition ?? (typeof node.type === 'string' ? (value as object) : undefined)
  const names: string[] = []

  if (typeof recognition === 'string') {
    if (
      recognition === 'Custom' &&
      typeof node.custom_recognition === 'string' &&
      node.custom_recognition
    ) {
      names.push(node.custom_recognition)
    }
    for (const key of ['all_of', 'any_of'] as const) {
      const sub = (value as Record<string, unknown>)[key]
      if (Array.isArray(sub)) {
        for (const item of sub) {
          if (typeof item === 'string') {
            if (!inlineOnly) {
              names.push(...resolveNode(item))
            }
          } else {
            names.push(...visitRecognition(item, resolveNode, inlineOnly))
          }
        }
      }
    }
    return names
  }

  if (!recognition || typeof recognition !== 'object') {
    return names
  }
  const { type, param } = recognition as { type?: unknown; param?: unknown }
  const parameters = param && typeof param === 'object' ? (param as Record<string, unknown>) : {}
  if (type === 'Custom') {
    const name = parameters.custom_recognition
    if (typeof name === 'string' && name) {
      names.push(name)
    }
    return names
  }
  if (type === 'And' || type === 'Or') {
    const sub = type === 'And' ? parameters.all_of : parameters.any_of
    if (Array.isArray(sub)) {
      for (const item of sub) {
        if (typeof item === 'string') {
          if (!inlineOnly) {
            names.push(...resolveNode(item))
          }
        } else {
          names.push(...visitRecognition(item, resolveNode, inlineOnly))
        }
      }
    }
  }
  return names
}

/** 从 `Resource.get_node_data` 返回的节点定义里取出内联的 custom 识别名（不展开节点名引用）。 */
export function collectCustomRecognitionNames(nodeData: string | null | undefined): string[] {
  if (!nodeData) {
    return []
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(nodeData)
  } catch {
    return []
  }
  return [...new Set(visitRecognition(parsed, () => [], true))]
}

/**
 * 汇总待测节点需要的 custom 识别名与引用它的根节点。
 * And/Or 的子项可以是节点名（Pipeline v5.7+），必须递归展开，否则被引用节点里的
 * Custom 识别会漏检，最终退化成识别未命中。结果按节点缓存，避免菱形引用扇出。
 */
export function requiredCustomRecognitions(
  nodes: readonly string[],
  getNodeData: (node: string) => string | null
): CustomRecognitionRequirement[] {
  /** 单条引用链允许的最大层级，防止异常数据把栈打爆。 */
  const MAX_DEPTH = 256
  const cache = new Map<string, string[]>()

  const resolve = (
    node: string,
    path: Set<string>,
    depth: number
  ): { names: string[]; cyclic: boolean } => {
    const cached = cache.get(node)
    if (cached) {
      return { names: cached, cyclic: false }
    }
    if (path.has(node)) {
      return { names: [], cyclic: true }
    }
    if (depth > MAX_DEPTH) {
      throw new Error(`节点引用层级超过 ${MAX_DEPTH} 层，无法确定 Custom 识别需求：${node}`)
    }
    const data = getNodeData(node)
    if (data === null) {
      return { names: [], cyclic: false }
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(data)
    } catch {
      return { names: [], cyclic: false }
    }
    const nextPath = new Set(path)
    nextPath.add(node)
    let cyclic = false
    const names = visitRecognition(parsed, child => {
      const result = resolve(child, nextPath, depth + 1)
      if (result.cyclic) {
        cyclic = true
      }
      return result.names
    })
    const unique = [...new Set(names)]
    if (!cyclic) {
      cache.set(node, unique)
    }
    return { names: unique, cyclic }
  }

  const owners = new Map<string, string[]>()
  for (const node of nodes) {
    const { names } = resolve(node, new Set(), 0)
    for (const name of names) {
      const list = owners.get(name) ?? []
      if (!list.includes(node)) {
        list.push(node)
      }
      owners.set(name, list)
    }
  }
  return [...owners].map(([name, roots]) => ({ name, nodes: roots }))
}

function formatRequirements(requirements: readonly CustomRecognitionRequirement[]) {
  return requirements.map(item => `${item.name}（节点 ${item.nodes.join(', ')}）`).join('；')
}

/** 没有可启动的 agent：说明是缺少配置而不是识别结果不命中。 */
export function formatMissingAgentError(
  requirements: readonly CustomRecognitionRequirement[]
): string {
  return `待测节点使用了 Custom 识别，但没有可启动的 agent：${formatRequirements(requirements)}。请在 test.agent 配置 agent，或在 interface.json 的 agent 中声明并确保可执行体已构建`
}

/** agent 已连接但没有注册要求的 custom 识别名。 */
export function formatUnregisteredAgentError(
  requirements: readonly CustomRecognitionRequirement[]
): string {
  return `agent 未注册这些 Custom 识别：${formatRequirements(requirements)}`
}
