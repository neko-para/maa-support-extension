import { checkInterface } from './interface'
import { checkPipeline } from './pipeline'
import type { Diagnostic, DiagnosticOption } from './types'

export type * from './types'
export { checkPipeline } from './pipeline'
export { checkInterface } from './interface'
export { buildDiagnosticMessage } from './message'

export function performDiagnostic(
  snapshot: Parameters<typeof checkPipeline>[0],
  option: DiagnosticOption = {}
): Diagnostic[] {
  const result: Diagnostic[] = []
  result.push(...checkPipeline(snapshot))
  result.push(...checkInterface(snapshot))

  return result
    .filter(diag => !option.ignoreTypes?.includes(diag.type))
    .map(diag => {
      if (option.errorTypes?.includes(diag.type)) {
        return { ...diag, level: 'error' as const }
      }
      return diag
    })
}
