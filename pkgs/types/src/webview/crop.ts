import * as maa from '@maaxyz/maa-node'

export type CropHostState = {
  backgroundFill?: string
  selectFill?: string
  selectOpacity?: string
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

export type CropHostToWeb = {
  command: 'updateState'
  state: CropHostState
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
      roi: maa.api.FlatRect
      expandRoi: maa.api.FlatRect
    }
