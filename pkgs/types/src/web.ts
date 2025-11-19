import type { LogCategory } from './logger'

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

export type CropViewContext = {
  uploadDir?: string

  saveAddRoiInfo?: boolean
  backgroundFill?: string
  selectFill?: string
  selectOpacity?: string
  revertScale?: boolean
  pointerAxesStroke?: string
  helperAxesStroke?: string
  helperAxesOpacity?: string
  helperAxesOverflow?: string
  helperAxesRadius?: string
  helperAxesThreshold?: string
  ocrStroke?: string
  ocrFont?: string
  recoStroke?: string
  recoFont?: string
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
      roi: maa.Rect
      expandRoi: maa.Rect
    }
  | {
      cmd: 'requestOCR'
      image: string
      roi: maa.Rect
    }
  | {
      cmd: 'requestReco'
      image: string
    }

export type CropViewFromHost =
  | {
      cmd: 'setImage'
      image: string
    }
  | {
      cmd: 'decreaseLoading'
    }
  | {
      cmd: 'ocrResult'
      data: string | null
    }
  | {
      cmd: 'recoResult'
      data: string | null
    }
