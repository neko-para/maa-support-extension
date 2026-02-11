import type { HostStateBase } from './base'

export type LaunchHostState = HostStateBase & {
  stopped?: boolean
  paused?: boolean

  knownTasks?: string[]
  breakTasks?: string[]
}

export type LaunchHostToWeb =
  | {
      command: 'updateState'
      state: LaunchHostState
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
