import {
  type FormattingOptions,
  type ParseError,
  applyEdits,
  modify,
  parse,
  printParseErrorCode
} from 'jsonc-parser'
import * as path from 'node:path'

const formatting: FormattingOptions = { tabSize: 2, insertSpaces: true, eol: '\n' }

const configMark = '$__mpe_code'
const configMarkPrefix = '$__mpe_config_'
const externalMarkPrefix = '$__mpe_external_'
const anchorMarkPrefix = '$__mpe_anchor_'
const stickerMarkPrefix = '$__mpe_sticker_'
const groupMarkPrefix = '$__mpe_group_'

export type MpeConfig = {
  file_config: Record<string, unknown> & { filename?: string }
  node_configs: Record<string, unknown>
  external_nodes?: Record<string, unknown>
  anchor_nodes?: Record<string, unknown>
  sticker_nodes?: Record<string, unknown>
  group_nodes?: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function parseJsonObject(text: string, label: string) {
  const errors: ParseError[] = []
  const data = parse(text, errors, { allowTrailingComma: true, disallowComments: false })
  if (errors.length || !data || typeof data !== 'object' || Array.isArray(data)) {
    const detail = errors[0]
      ? printParseErrorCode(errors[0].error)
      : `${label} must be a JSON object`
    throw new Error(`${label} JSONC parse failed: ${detail}`)
  }
  return data as Record<string, unknown>
}

export const mpeProtocol = 'mpe-embed'
export const mpeProtocolVersion = '1.3.0'

export type MpeProtocolMessage = {
  protocol: typeof mpeProtocol
  version: string
  type: string
  requestId?: string
  payload?: unknown
}

export function isCompatibleMpeMessage(value: unknown): value is MpeProtocolMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const message = value as Record<string, unknown>
  return (
    message.protocol === mpeProtocol &&
    typeof message.version === 'string' &&
    message.version.split('.')[0] === mpeProtocolVersion.split('.')[0] &&
    typeof message.type === 'string' &&
    (message.requestId === undefined || typeof message.requestId === 'string')
  )
}

export function isMpeReadyForRequest(value: unknown, requestId: string) {
  return (
    isCompatibleMpeMessage(value) && value.type === 'mpe:ready' && value.requestId === requestId
  )
}

export function parsePipeline(text: string) {
  return parseJsonObject(text, 'Pipeline')
}

export function parseMpeConfig(text: string): MpeConfig {
  const data = parseJsonObject(text, 'MPE config')
  return {
    file_config: { filename: '', ...asRecord(data.file_config) },
    node_configs: asRecord(data.node_configs) ?? {},
    ...(asRecord(data.external_nodes) ? { external_nodes: asRecord(data.external_nodes) } : {}),
    ...(asRecord(data.anchor_nodes) ? { anchor_nodes: asRecord(data.anchor_nodes) } : {}),
    ...(asRecord(data.sticker_nodes) ? { sticker_nodes: asRecord(data.sticker_nodes) } : {}),
    ...(asRecord(data.group_nodes) ? { group_nodes: asRecord(data.group_nodes) } : {})
  }
}

export function mpeSidecarPath(pipelinePath: string) {
  const baseName = path.basename(pipelinePath).replace(/\.(json|jsonc)$/i, '')
  return path.join(path.dirname(pipelinePath), `.${baseName}.mpe.json`)
}

function isLegacyConfigKey(key: string) {
  return key.startsWith('__mpe_config_') || key.startsWith('__yamaape_config_')
}

function extractNodeName(key: string, prefix: string, fileName: string) {
  const withoutPrefix = key.substring(prefix.length)
  const suffix = `_${fileName}`
  if (fileName && withoutPrefix.endsWith(suffix)) {
    return withoutPrefix.slice(0, -suffix.length)
  }
  return withoutPrefix
}

function buildMpeCode(nodeData: unknown) {
  const rec = asRecord(nodeData)
  if (rec?.position) {
    const mpeCode: Record<string, unknown> = { position: rec.position }
    if (rec.handleDirection) {
      mpeCode.handleDirection = rec.handleDirection
    }
    if (Array.isArray(rec.extra_positions) && rec.extra_positions.length > 0) {
      mpeCode.extra_positions = rec.extra_positions
    }
    return mpeCode
  }
  const wrapped = asRecord(rec?.[configMark])
  return wrapped ?? { position: { x: 0, y: 0 } }
}

function extractNodeConfig(mpeCode: unknown) {
  const rec = asRecord(mpeCode)
  if (!rec?.position) {
    return null
  }
  const nodeConfig: Record<string, unknown> = { position: rec.position }
  if (rec.handleDirection) {
    nodeConfig.handleDirection = rec.handleDirection
  }
  if (Array.isArray(rec.extra_positions)) {
    nodeConfig.extra_positions = rec.extra_positions
  }
  return nodeConfig
}

export function mergePipelineAndConfig(
  pipeline: Record<string, unknown>,
  config: MpeConfig,
  fileName?: string,
  keyOrder?: string[]
) {
  const actualFileName = fileName || String(config.file_config.filename || '未命名')
  const merged: Record<string, unknown> = {
    [configMarkPrefix + actualFileName]: {
      [configMark]: {
        ...config.file_config,
        filename: actualFileName
      }
    }
  }
  const added = new Set<string>([configMarkPrefix + actualFileName])

  const specials = [
    [externalMarkPrefix, config.external_nodes] as const,
    [anchorMarkPrefix, config.anchor_nodes] as const,
    [stickerMarkPrefix, config.sticker_nodes] as const,
    [groupMarkPrefix, config.group_nodes] as const
  ]

  const specialByName = specials.map(([prefix, nodes]) => {
    const map = new Map<string, unknown>()
    if (nodes) {
      for (const [nodeName, nodeData] of Object.entries(nodes)) {
        map.set(nodeName, nodeData)
      }
    }
    return { prefix, map }
  })

  const addSpecial = (prefix: string, nodeName: string, data: unknown) => {
    const key = prefix + nodeName + '_' + actualFileName
    if (added.has(key)) {
      return
    }
    merged[key] = {
      [configMark]:
        prefix === stickerMarkPrefix || prefix === groupMarkPrefix
          ? (asRecord(data) ?? { position: { x: 0, y: 0 } })
          : buildMpeCode(data)
    }
    added.add(key)
  }

  const addNormal = (key: string, value: unknown) => {
    const nodeConfig = asRecord(config.node_configs[key])
    if (nodeConfig?.position) {
      merged[key] = {
        ...asRecord(value),
        [configMark]: buildMpeCode(nodeConfig)
      }
    } else {
      merged[key] = value
    }
    added.add(key)
  }

  const keys = keyOrder?.length ? keyOrder : Object.keys(pipeline)
  for (const originalKey of keys) {
    if (originalKey.startsWith(configMarkPrefix) || isLegacyConfigKey(originalKey)) {
      continue
    }

    const special = specialByName.find(item => originalKey.startsWith(item.prefix))
    if (special) {
      const nodeName = extractNodeName(originalKey, special.prefix, actualFileName)
      const nodeData = special.map.get(nodeName)
      if (nodeData !== undefined) {
        addSpecial(special.prefix, nodeName, nodeData)
      }
      continue
    }

    if (pipeline[originalKey] !== undefined) {
      addNormal(originalKey, pipeline[originalKey])
    }
  }

  for (const { prefix, map } of specialByName) {
    for (const [nodeName, nodeData] of map) {
      addSpecial(prefix, nodeName, nodeData)
    }
  }

  if (keyOrder?.length) {
    for (const [key, value] of Object.entries(pipeline)) {
      if (!added.has(key) && !key.startsWith(configMarkPrefix) && !isLegacyConfigKey(key)) {
        addNormal(key, value)
      }
    }
  }

  return merged
}

export function splitPipelineAndConfig(pipelineObj: Record<string, unknown>): {
  pipeline: Record<string, unknown>
  config: MpeConfig
} {
  const pipeline: Record<string, unknown> = {}
  const config: MpeConfig = {
    file_config: { filename: '' },
    node_configs: {},
    external_nodes: {},
    anchor_nodes: {},
    sticker_nodes: {},
    group_nodes: {}
  }

  for (const [key, value] of Object.entries(pipelineObj)) {
    if (!key.startsWith(configMarkPrefix)) {
      continue
    }
    const fileConfig = asRecord(asRecord(value)?.[configMark])
    if (fileConfig) {
      config.file_config = {
        ...fileConfig,
        filename: typeof fileConfig.filename === 'string' ? fileConfig.filename : ''
      }
    }
  }

  const filename = String(config.file_config.filename || '')
  const specials = [
    [externalMarkPrefix, 'external_nodes'] as const,
    [anchorMarkPrefix, 'anchor_nodes'] as const,
    [stickerMarkPrefix, 'sticker_nodes'] as const,
    [groupMarkPrefix, 'group_nodes'] as const
  ]

  for (const [key, value] of Object.entries(pipelineObj)) {
    if (key.startsWith(configMarkPrefix)) {
      continue
    }

    const rec = asRecord(value)
    const special = specials.find(([prefix]) => key.startsWith(prefix))
    if (special) {
      const [prefix, field] = special
      const nodeName = extractNodeName(key, prefix, filename)
      const mpeCode = rec?.[configMark]
      if (field === 'sticker_nodes' || field === 'group_nodes') {
        config[field]![nodeName] = mpeCode ?? { position: { x: 0, y: 0 } }
      } else {
        config[field]![nodeName] = extractNodeConfig(mpeCode) ?? { position: { x: 0, y: 0 } }
      }
      continue
    }

    const nodeConfig = extractNodeConfig(rec?.[configMark])
    if (nodeConfig) {
      config.node_configs[key] = nodeConfig
    }
    if (rec) {
      const { [configMark]: _, ...pureNode } = rec
      pipeline[key] = pureNode
    } else {
      pipeline[key] = value
    }
  }

  if (Object.keys(config.external_nodes!).length === 0) {
    delete config.external_nodes
  }
  if (Object.keys(config.anchor_nodes!).length === 0) {
    delete config.anchor_nodes
  }
  if (Object.keys(config.sticker_nodes!).length === 0) {
    delete config.sticker_nodes
  }
  if (Object.keys(config.group_nodes!).length === 0) {
    delete config.group_nodes
  }

  return { pipeline, config }
}

export function stringifyMpeConfig(config: MpeConfig) {
  return JSON.stringify(config, null, formatting.tabSize) + formatting.eol
}

export function updatePipelineText(
  text: string,
  previous: Record<string, unknown>,
  next: Record<string, unknown>
) {
  // `next` is the complete Pipeline snapshot returned by MPE, not a partial patch.
  let result = text
  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    if (JSON.stringify(previous[key]) === JSON.stringify(next[key])) continue
    result = applyEdits(result, modify(result, [key], next[key], { formattingOptions: formatting }))
  }
  return result
}

export function hasDocumentVersionConflict(
  loadedVersion: number | undefined,
  requestedVersion: number,
  currentVersion: number
) {
  return (
    currentVersion !== requestedVersion ||
    (loadedVersion !== undefined && currentVersion !== loadedVersion)
  )
}

export function isCurrentDocumentSnapshot(readVersion: number, currentVersion: number) {
  return readVersion === currentVersion
}

export function normalizeExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}
