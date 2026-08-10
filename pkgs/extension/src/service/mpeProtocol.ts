import {
  type FormattingOptions,
  type ParseError,
  applyEdits,
  modify,
  parse,
  printParseErrorCode
} from 'jsonc-parser'

const formatting: FormattingOptions = { tabSize: 2, insertSpaces: true, eol: '\n' }

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
  const errors: ParseError[] = []
  const data = parse(text, errors, { allowTrailingComma: true, disallowComments: false })
  if (errors.length || !data || typeof data !== 'object' || Array.isArray(data)) {
    const detail = errors[0]
      ? printParseErrorCode(errors[0].error)
      : 'Pipeline must be a JSON object'
    throw new Error(`Pipeline JSONC parse failed: ${detail}`)
  }
  return data as Record<string, unknown>
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

export function normalizeExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}
