import type * as maa from '@nekosu/maa-node'

export type RecoInfo = {
  raw: string
  draws: string[]
  info: {
    name: string
    hit: boolean
    hit_box: maa.Rect
    detail_json: string
  }
}

export type ExtToWeb =
  | {
      cmd: 'launch.setup'
    }
  | {
      cmd: 'launch.notify'
      msg: string
      details: string
    }
  | ({
      cmd: 'show.reco'
    } & RecoInfo)

export type WebToExt = {
  cmd: 'launch.reco'
  reco: number
}
