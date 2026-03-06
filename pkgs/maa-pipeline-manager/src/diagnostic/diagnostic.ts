import type { InterfaceBundle } from '../interface/interface'
import { checkInterface } from './interface'
import { checkTask } from './task'
import type { Diagnostic, DiagnosticOption } from './types'

export { buildDiagnosticMessage } from './message'

export function performDiagnostic(bundle: InterfaceBundle, option: DiagnosticOption): Diagnostic[] {
  const result: Diagnostic[] = []

  result.push(...checkTask(bundle))
  result.push(...checkInterface(bundle))

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
