import type { HostStateBase } from './base'

export type LaunchHostState = HostStateBase & {
  stopped?: boolean
  paused?: boolean

  knownTasks?: string[]
  breakTasks?: string[]
  analyzerUrl?: string
}

export type RealtimeEndReason = 'finished' | 'stopped' | 'disposed' | 'error'

export type RealtimeStartParams = {
  sessionId: string
  instanceId: string
  source: 'maa-support-extension'
  supportVersion?: string
  maaVersion?: string
  startedAt: number
}

export type RealtimeEndParams = {
  sessionId: string
  reason: RealtimeEndReason
  endedAt: number
}

export type LaunchHostToWeb =
  | {
      command: 'updateState'
      state: LaunchHostState
    }
  | {
      command: 'realtimeStart'
      params: RealtimeStartParams
    }
  | {
      command: 'realtimeEnd'
      params: RealtimeEndParams
    }
  | {
      command: 'notifyStatus'
      msg: maa.TaskerNotify | maa.TaskerContextNotify
    }

export type LaunchWebToHost =
  | {
      command: 'requestStop'
    }
  | {
      // return RecoInfo | null
      command: 'requestReco'
      reco_id: number
    }
  | {
      // return ActionInfo | null
      command: 'requestAct'
      action_id: number
    }
  | {
      // return string | null
      command: 'requestNode'
      node: string
    }
  | {
      command: 'requestPause'
    }
  | {
      command: 'requestContinue'
    }
  | {
      command: 'updateBreakTasks'
      tasks: string[]
    }
  | {
      command: 'openCrop'
      image: string
      detail?: maa.RecoDetailWithoutDraws
    }
  | {
      command: 'gotoTask'
      task: string
    }
  | {
      // return string
      command: 'taskDoc'
      task: string
    }

export type RecoInfo = {
  raw: string
  draws: string[]
  info: maa.RecoDetailWithoutDraws
}

export type ActionInfo = maa.ActionDetail
