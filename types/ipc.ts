import type * as maa from '@nekosu/maa-node'

export type RecoInfo = {
  raw: string
  draws: string[]
  info: {
    name: string
    algorithm: string
    hit: boolean
    box: maa.api.Rect
    detail: string
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
  | {
      cmd: 'crop.setup'
    }
  | {
      cmd: 'crop.image'
      image: string
    }

export type WebToExt =
  | {
      cmd: 'launch.reco'
      reco: number
    }
  | {
      cmd: 'launch.stop'
    }
  | {
      cmd: 'crop.screencap'
    }
  | {
      cmd: 'crop.upload'
    }
  | {
      cmd: 'crop.download'
      image: string
      roi: maa.api.FlatRect
      expandRoi: maa.api.FlatRect
    }
