import type { LayerInfo } from '../layer/layer'
import type { InterfaceDeclInfo, InterfaceRefInfo } from '../parser/interface/interface'
import { checkInterface } from './interface'
import { checkTask } from './task'
import type { Diagnostic, DiagnosticOption } from './types'

export { buildDiagnosticMessage } from './message'

export interface DiagnosticContext {
  allLayers: LayerInfo[]
  maa: boolean
  langBundle: {
    queryKey(key: string): ({ key: string; value: string } | null)[]
    langs: { name: string }[]
  }
  topLayer: LayerInfo
  decls: InterfaceDeclInfo[]
  refs: InterfaceRefInfo[]
}

export function performDiagnostic(ctx: DiagnosticContext, option: DiagnosticOption): Diagnostic[] {
  const result: Diagnostic[] = []

  result.push(...checkTask(ctx))
  result.push(...checkInterface(ctx))

  return result
    .filter(diag => !option.ignoreTypes?.includes(diag.type))
    .map(diag => {
      if (option.errorTypes?.includes(diag.type)) {
        const newDiag = { ...diag }
        newDiag.level = 'error'
        return newDiag
      } else {
        return diag
      }
    })
}
