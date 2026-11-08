import { ref } from 'vue'

/**
 * 最近运行：一次「识别测试」的参数快照 + 结果徽标 + 耗时。
 * 只放最近 5 条；点击回填参数只填自己目标使用的那组，节点参数来自 pipeline 不归面板管。
 * 叶子模块：不 import 其他 states，参数快照由调用方传入。
 *
 * `record` 返回存在数组里的那条；调用方拿到结果后直接改它的 hit/value/elapsedMs，
 * reactive 数组里的对象字段变化会正常派发。
 */

export type RunTarget = 'template' | 'ocr' | 'color' | 'node'

export interface RunEntry {
  /** 归到哪个目标页签下 */
  target: RunTarget
  /** 该目标运行时实际使用的参数（模板：method/threshold/greenMask；ocr：onlyRec；颜色：count/connected/method；节点：roiSource） */
  params: Record<string, string | number | boolean>
  /** 运行时的画布 ROI（当时实际生效值，回填仅参考不复原） */
  roi: [number, number, number, number] | null
  /** 完成前 null；跑完再回填 */
  hit: boolean | null
  /** 摘要值：score / count / text / label 等 */
  value: string | null
  ranAt: number
}

export const entries = ref<RunEntry[]>([])
const MAX = 5

export function record(entry: RunEntry): RunEntry {
  entries.value = [entry, ...entries.value].slice(0, MAX)
  return entry
}

export function clear() {
  entries.value = []
}
