import type { HostStateBase } from './base'

export type CropHostState = HostStateBase & {
  saveAddRoiInfo?: boolean
  backgroundFill?: string
  selectFill?: string
  selectOpacity?: number
  revertScale?: boolean
  pointerAxesStroke?: string
  helperAxesStroke?: string
  helperAxesOpacity?: number
  helperAxesOverflow?: boolean
  helperAxesRadius?: number
  helperAxesThreshold?: number
  pickColorThreshold?: number
  ocrStroke?: string
  ocrFont?: string
  recoStroke?: string
  recoFont?: string
}

export type CropHostToWeb =
  | {
      command: 'updateState'
      state: CropHostState
    }
  | {
      command: 'setImage'
      image: string
    }

export type CropWebToHost =
  | {
      // return string | null
      command: 'requestScreencap'
    }
  | {
      // return string | null
      command: 'requestUpload'
    }
  | {
      // return void
      command: 'requestSave'
      image: string
      crop: maa.Rect
      roi: maa.Rect
      expandRoi: maa.Rect
    }
  | {
      // return string | null
      command: 'requestOCR'
      image: string
      roi: maa.Rect
    }
  | {
      // return string | null
      command: 'requestReco'
      image: string
    }
  | {
      command: 'writeClipboard'
      text: string
    }
  | {
      // return string
      command: 'readClipboard'
    }
  | {
      command: 'updateSettings'
      key: string
      value: unknown
    }
