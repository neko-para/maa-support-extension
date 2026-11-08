import type { PipelineVersion } from '../states/visible'

/**
 * Pipeline 片段两种协议形态：
 * - v1 平铺：字段直接铺在节点对象上（`"recognition": "ColorMatch"` + 顶层 lower/upper/…）
 * - v2 纵深：`recognition` 收进 `{ type, param }`，其余字段仍与 v1 同层
 */

function flat2quoted(fields: [string, string][]) {
  return fields.map(([k, v]) => `"${k}": ${v}`)
}

export function colorMatchSnippet(
  version: PipelineVersion,
  roi: [number, number, number, number],
  method: number,
  lower: number[][],
  upper: number[][],
  count: number,
  connected: boolean
): string {
  if (version === 'v1') {
    return flat2quoted([
      ['recognition', '"ColorMatch"'],
      ['roi', `[${roi.join(', ')}]`],
      ['method', `${method}`],
      ['lower', JSON.stringify(lower)],
      ['upper', JSON.stringify(upper)],
      ['count', `${count}`],
      ['connected', `${connected}`]
    ]).join(',\n')
  }
  // v2：recognition 收进 type/param
  const param = flat2quoted([
    ['roi', `[${roi.join(', ')}]`],
    ['method', `${method}`],
    ['lower', JSON.stringify(lower)],
    ['upper', JSON.stringify(upper)],
    ['count', `${count}`],
    ['connected', `${connected}`]
  ])
  return [
    '"recognition": {',
    `  "type": "ColorMatch",`,
    '  "param": {',
    param.map(l => `    ${l}`).join(',\n'),
    '  }',
    '}'
  ].join('\n')
}

/** 模板匹配「识别测试」参数（不是保存模板后的 template 片段） */
export function templateMatchSnippet(
  version: PipelineVersion,
  roi: [number, number, number, number],
  threshold: number,
  method: number,
  greenMask: boolean
): string {
  const lines: [string, string][] = [
    ['roi', `[${roi.join(', ')}]`],
    ['method', `${method}`],
    ['threshold', `${threshold}`]
  ]
  if (greenMask) {
    lines.push(['green_mask', 'true'])
  }
  if (version === 'v1') {
    return flat2quoted([['recognition', '"TemplateMatch"'], ...lines]).join(',\n')
  }
  return [
    '"recognition": {',
    `  "type": "TemplateMatch",`,
    '  "param": {',
    flat2quoted(lines)
      .map(l => `    ${l}`)
      .join(',\n'),
    '  }',
    '}'
  ].join('\n')
}

/** OCR「识别测试」参数 */
export function ocrSnippet(
  version: PipelineVersion,
  roi: [number, number, number, number],
  onlyRec: boolean
): string {
  const lines: [string, string][] = [['roi', `[${roi.join(', ')}]`]]
  if (onlyRec) {
    lines.push(['only_rec', 'true'])
  }
  if (version === 'v1') {
    return flat2quoted([['recognition', '"OCR"'], ...lines]).join(',\n')
  }
  return [
    '"recognition": {',
    `  "type": "OCR",`,
    '  "param": {',
    flat2quoted(lines)
      .map(l => `    ${l}`)
      .join(',\n'),
    '  }',
    '}'
  ].join('\n')
}

export function templateSnippet(
  version: PipelineVersion,
  template: string,
  greenMask: boolean
): string {
  const lines: [string, string][] = [['template', JSON.stringify(template)]]
  if (greenMask) {
    lines.push(['green_mask', 'true'])
  }
  if (version === 'v1') {
    return flat2quoted([['recognition', '"TemplateMatch"'], ...lines]).join(',\n')
  }
  return [
    '"recognition": {',
    `  "type": "TemplateMatch",`,
    '  "param": {',
    flat2quoted(lines)
      .map(l => `    ${l}`)
      .join(',\n'),
    '  }',
    '}'
  ].join('\n')
}
