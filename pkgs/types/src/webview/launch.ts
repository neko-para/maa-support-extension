import * as maa from '@maaxyz/maa-node'

export type LaunchHostState = {
  stopped?: boolean
  paused?: boolean
}

export type LaunchHostToWeb =
  | {
      command: 'updateState'
      state: LaunchHostState
    }
  | {
      command: 'notifyStatus'
      msg: string
      details: string
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

export type RecoInfo = {
  raw: string
  draws: string[]
  info: {
    name: string
    algorithm: string
    hit: boolean
    box: maa.api.Rect
    detail: maa.RecoDetail
  }
}
