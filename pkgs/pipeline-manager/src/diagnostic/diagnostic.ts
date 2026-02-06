import type { InterfaceBundle } from '../interface/interface'
import { checkInterface } from './interface'
import { checkTask } from './task'
import type { Diagnostic } from './types'

export type { Diagnostic }
export { buildDiagnosticMessage } from './message'

export function performDiagnostic<T>(bundle: InterfaceBundle<T>): Diagnostic[] {
  const result: Diagnostic[] = []

  result.push(...checkTask(bundle))
  result.push(...checkInterface(bundle))

  return result
}
