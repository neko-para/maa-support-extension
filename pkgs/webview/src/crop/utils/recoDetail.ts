/**
 * 识别结果字段按算法不同：TemplateMatch 有 score，FeatureMatch / ColorMatch 有 count，
 * OCR 有 text，NeuralNetworkClassify / NeuralNetworkDetect 有 cls_index / label；
 * Custom 的 detail 不在此展示，看原始 JSON。
 */
export function entryValue(entry: maa.RecoDetailEntry): string | undefined {
  if (entry.score !== undefined) {
    return entry.score.toFixed(4)
  }
  if (entry.count !== undefined) {
    return `count=${entry.count}`
  }
  const cls: string[] = []
  if (entry.cls_index !== undefined) {
    cls.push(`cls_index=${entry.cls_index}`)
  }
  if (entry.label !== undefined) {
    cls.push(`label=${entry.label}`)
  }
  if (cls.length > 0) {
    return cls.join(' ')
  }
  return undefined
}

export type RecoSummary = {
  hit: boolean
  algorithm: string
  /** 命中框；未命中时为 null */
  box: maa.Rect | null
  /** 最优条目的关键值（score / count / text 等） */
  value?: string
  /** 候选总数（all 的长度），组合识别为子识别数 */
  candidates: number
}

/** 一行就能读懂的结论：命中与否、算法、最优值、命中框 */
export function summarize(detail: maa.RecoDetailWithoutDraws): RecoSummary {
  const summary: RecoSummary = {
    hit: detail.hit,
    algorithm: detail.algorithm,
    box: detail.box,
    candidates: 0
  }
  if (Array.isArray(detail.detail)) {
    summary.candidates = detail.detail.length
  } else if (detail.detail) {
    summary.candidates = detail.detail.all.length
    // 未命中时没有 best，给出得分最高的候选，用户能看出离阈值还差多少
    const best =
      detail.detail.best ??
      detail.detail.filtered[0] ??
      detail.detail.all.reduce<maa.RecoDetailEntry | undefined>(
        (top, entry) => (!top || (entry.score ?? 0) > (top.score ?? 0) ? entry : top),
        undefined
      )
    if (best) {
      const value = entryValue(best)
      summary.value = best.text ? `"${best.text}"${value ? ` ${value}` : ''}` : value
    }
  }
  return summary
}
