import type { LayerTaskInfo } from '../../layer/layer'
import { actKeys, recoKeys } from '../../parser/task/fw/keys'
import { buildTree } from '../../utils/json'

export function evalTask(
  info: LayerTaskInfo | undefined,
  parentResult: Record<string, unknown> | undefined,
  defaultObj: Record<string, unknown>,
  recoObj: Record<string, unknown>,
  actObj: Record<string, unknown>
): Record<string, unknown> {
  const result = parentResult ?? {}

  if (info) {
    const parts = info.info.parts

    if (!parentResult) {
      Object.assign(result, defaultObj)
      Object.assign(result, recoObj)
      Object.assign(result, actObj)
    }

    let recoChanged = false
    let actChanged = false
    if (parts.recoType) {
      const oldReco = (result.recognition as string) ?? 'DirectHit'
      const newReco = parts.recoType.value
      recoChanged = newReco !== oldReco
      result['recognition'] = parts.recoType.value
    }
    if (parts.actType) {
      const oldAct = (result.action as string) ?? 'DoNothing'
      const newAct = parts.actType.value
      actChanged = newAct !== oldAct
      result['action'] = parts.actType.value
    }
    if (recoChanged) {
      for (const key of recoKeys) {
        delete result[key]
      }
    }
    if (actChanged) {
      for (const key of actKeys) {
        delete result[key]
      }
    }
    for (const [key, obj] of [...parts.base, ...parts.reco, ...parts.act, ...parts.unknown]) {
      if (key === 'attach') {
        result[key] = Object.assign(result[key] ?? {}, buildTree(obj))
      } else {
        result[key] = buildTree(obj)
      }
    }
  }

  return result
}
