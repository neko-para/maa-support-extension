import type { ColorMatchOptions } from '@nekosu/maa-types'

/** 归一化后的 ColorMatch 参数：所有字段都是显式值，不依赖框架默认值 */
export type NormalizedColorMatchOptions = {
  roi: maa.Rect
  method: 4 | 40 | 6
  lower: number[][]
  upper: number[][]
  count: number
  connected: boolean
}

export type NormalizeColorMatchOptionsResult =
  | { ok: true; value: NormalizedColorMatchOptions }
  | { ok: false; error: string }

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

// ColorMatch 的通道数：RGB / HSV 为 3，GRAY 为 1
function channelCount(method: 4 | 40 | 6) {
  return method === 6 ? 1 : 3
}

// HSV 的 H 取值是 [0, 179]，其余通道（含 RGB / GRAY）都是 [0, 255]
function channelMax(method: 4 | 40 | 6, channel: number) {
  return method === 40 && channel === 0 ? 179 : 255
}

function parseMethod(raw: unknown): ParseResult<4 | 40 | 6> {
  if (raw === 4 || raw === 40 || raw === 6) {
    return { ok: true, value: raw }
  }
  return { ok: false, error: `method 必须是 4(RGB)、40(HSV) 或 6(GRAY)，实际为 ${String(raw)}` }
}

function parseRoi(raw: unknown): ParseResult<maa.Rect> {
  if (!Array.isArray(raw) || raw.length !== 4) {
    return { ok: false, error: 'roi 必须是 [x, y, width, height] 形式的数组' }
  }
  const value: number[] = []
  for (const item of raw) {
    if (typeof item !== 'number' || !Number.isFinite(item)) {
      return { ok: false, error: 'roi 的每个分量必须是有限数字' }
    }
    value.push(Math.round(item))
  }
  const [x, y, width, height] = value
  if (width < 0 || height < 0) {
    return { ok: false, error: 'roi 的宽度和高度不能为负数' }
  }
  return { ok: true, value: [x, y, width, height] }
}

function parseColorRanges(
  raw: unknown,
  name: 'lower' | 'upper',
  method: 4 | 40 | 6
): ParseResult<number[][]> {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: `${name} 必须至少包含一个颜色区间` }
  }
  const channels = channelCount(method)
  const value: number[][] = []
  for (let idx = 0; idx < raw.length; idx++) {
    const range: unknown = raw[idx]
    if (!Array.isArray(range) || range.length !== channels) {
      return {
        ok: false,
        error: `${name}[${idx}] 必须是长度为 ${channels} 的数组（method ${method} 需要 ${channels} 个通道）`
      }
    }
    const parsed: number[] = []
    for (let channel = 0; channel < channels; channel++) {
      const item: unknown = range[channel]
      if (typeof item !== 'number' || !Number.isFinite(item)) {
        return { ok: false, error: `${name}[${idx}][${channel}] 必须是有限数字` }
      }
      parsed.push(Math.min(Math.max(Math.round(item), 0), channelMax(method, channel)))
    }
    value.push(parsed)
  }
  return { ok: true, value }
}

function parseCount(raw: unknown): ParseResult<number> {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return { ok: false, error: 'count 必须是有限数字' }
  }
  // ColorMatch 的 count 是「命中像素数下限」，0 会让空掩码也算命中，因此不低于 1
  return { ok: true, value: Math.max(1, Math.round(raw)) }
}

/**
 * 校验并归一化一次性的 ColorMatch 参数。
 *
 * 通道数、区间数、取值范围都按 MaaFramework 语义收口：把非法参数挡在原生层之前，
 * 否则框架只会在识别阶段给出难以定位到具体字段的错误。
 */
export function normalizeColorMatchOptions(
  options: ColorMatchOptions
): NormalizeColorMatchOptionsResult {
  if (!options || typeof options !== 'object') {
    return { ok: false, error: 'options 必须是对象' }
  }
  const raw = options as unknown as Record<string, unknown>

  const method = parseMethod(raw.method)
  if (!method.ok) {
    return method
  }

  const roi = parseRoi(raw.roi)
  if (!roi.ok) {
    return roi
  }

  const lower = parseColorRanges(raw.lower, 'lower', method.value)
  if (!lower.ok) {
    return lower
  }

  const upper = parseColorRanges(raw.upper, 'upper', method.value)
  if (!upper.ok) {
    return upper
  }

  if (lower.value.length !== upper.value.length) {
    return {
      ok: false,
      error: `lower 与 upper 的区间数必须一致，实际为 ${lower.value.length} 和 ${upper.value.length}`
    }
  }

  const count = parseCount(raw.count)
  if (!count.ok) {
    return count
  }

  return {
    ok: true,
    value: {
      roi: roi.value,
      method: method.value,
      lower: lower.value,
      upper: upper.value,
      count: count.value,
      connected: Boolean(raw.connected)
    }
  }
}
