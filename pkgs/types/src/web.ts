import type * as maa from '@maaxyz/maa-node'

import type { LogCategory } from './logger'
import type { Interface, InterfaceConfig, InterfaceRuntime } from './pi'

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
  | {
      __builtin: true
      cmd: 'awake'
    }
  | {
      __builtin: true
      cmd: 'log'
      message: string
      type: LogCategory
    }

export type IpcFromHost<Context, Rest extends IpcRest> = IpcFromHostBuiltin<Context> | Rest

export type IpcToHost<Context, Rest extends IpcRest> = IpcToHostBuiltin<Context> | Rest

export type MaaEnumForward =
  | 'Status'
  | 'AdbScreencapMethod'
  | 'AdbInputMethod'
  | 'Win32ScreencapMethod'
  | 'Win32InputMethod'

export type ControlPanelContext = {
  maaEnum?: Pick<typeof maa.api, MaaEnumForward>

  interfaceList?: string[]
  interfaceCurrent?: string
  interfaceRefreshing?: boolean

  interfaceProjectDir?: string
  interfaceObj?: Partial<Interface>
  interfaceConfigObj?: Partial<InterfaceConfig>

  interfaceAddTask?: string

  adbDeviceList?: {
    name: string
    adb_path: string
    address: string
    config: unknown
  }[]
  adbDeviceRefreshing?: boolean

  desktopWindowList?: {
    window_name: string
    class_name: string
    hwnd: maa.api.DesktopHandle
  }[]
  desktopWindowRefreshing?: boolean
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
      runtime: InterfaceRuntime
    }
  | {
      cmd: 'stopInterface'
    }
  | {
      cmd: 'refreshAdbDevice'
    }
  | {
      cmd: 'refreshDesktopWindow'
    }
  | {
      cmd: 'revealInterfaceAt'
      dest:
        | {
            type: 'entry'
            entry: string
          }
        | {
            type: 'option'
            option: string
            case?: string
          }
    }

export type ControlPanelFromHost =
  | {
      cmd: 'launchInterface'
    }
  | {
      cmd: 'launchTask'
      task: string
    }

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

export type LaunchViewContext = {}

export type LaunchViewToHost =
  | {
      cmd: 'queryReco'
      reco: number
    }
  | {
      cmd: 'stopLaunch'
    }

export type LaunchViewFromHost =
  | {
      cmd: 'notify'
      msg: string
      details: string
    }
  | {
      cmd: 'stopped'
    }
  | ({
      cmd: 'showReco'
    } & RecoInfo)

export type CropViewContext = {
  uploadDir?: string

  backgroundFill?: string
  selectFill?: string
  selectOpacity?: string
  pointerAxesStroke?: string
  // pixelBoundStroke?: string
}

export type CropViewToHost =
  | {
      cmd: 'requestScreencap'
    }
  | {
      cmd: 'requestUpload'
    }
  | {
      cmd: 'requestSave'
      image: string
      roi: maa.api.FlatRect
      expandRoi: maa.api.FlatRect
    }

export type CropViewFromHost =
  | {
      cmd: 'setImage'
      image: string
    }
  | {
      cmd: 'decreaseLoading'
    }

export type OldWebContext = {
  uploadDir?: string
  selectFill?: string
}

export type OldWebToHost =
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

export type OldWebFromHost =
  | {
      cmd: 'crop.setup'
    }
  | {
      cmd: 'crop.image'
      image: string
    }
