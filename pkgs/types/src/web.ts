import type * as maa from '@maaxyz/maa-node'

import type { Interface, InterfaceConfig } from './pi'

export type IpcRest = {
  __builtin?: false
  cmd: string
}

export type IpcFromHostBuiltin<Context> =
  | {
      __builtin: true
      cmd: 'updateContext'
      ctx: Context
    }
  | {
      __builtin: true
      cmd: 'initContext'
      ctx: Context
    }

export type IpcToHostBuiltin<Context> =
  | {
      __builtin: true
      cmd: 'updateContext'
      ctx: Context
    }
  | {
      __builtin: true
      cmd: 'requestInit'
    }

export type IpcFromHost<Context, Rest extends IpcRest> = IpcFromHostBuiltin<Context> | Rest

export type IpcToHost<Context, Rest extends IpcRest> = IpcToHostBuiltin<Context> | Rest

export type ControlPanelContext = {
  interfaceList?: string[]
  interfaceCurrent?: string
  interfaceRefreshing?: boolean

  interfaceObj?: Partial<Interface>
  interfaceConfigObj?: Partial<InterfaceConfig>

  interfaceAddTask?: string
  interfaceLaunching?: boolean

  adbDeviceList?: {
    name: string
    adb_path: string
    address: string
    config: unknown
  }[]
  adbDeviceRefreshing?: boolean
}

export type ControlPanelToHost =
  | {
      cmd: 'refreshInterface'
    }
  | {
      cmd: 'selectInterface'
      interface: string
    }
  | {
      cmd: 'launchInterface'
    }
  | {
      cmd: 'refreshAdbDevice'
    }

export type ControlPanelFromHost = never

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
