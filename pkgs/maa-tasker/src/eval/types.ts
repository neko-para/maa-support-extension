import type { MaaTask } from '../types'

export type MaaTaskBaseNotResolved = MaaTask & { __baseTaskResolved?: false }
export type MaaTaskBaseResolved = MaaTask & { __baseTaskResolved: true }

export type MaaTraceAnchor = {
  anchor: string
  task: string
}

export type MaaTaskWithTraceInfo<MaaTaskType extends MaaTask> = {
  self: MaaTraceAnchor
  task: MaaTaskType
  trace: Record<string, MaaTraceAnchor>
}
