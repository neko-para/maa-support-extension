type FlatRect = [x: number, y: number, width: number, height: number]

export type MaaTaskExpr = string & { __brand: 'MaaTaskExpr' }

export type MaaTask = {
  __baseTaskResolved?: boolean

  baseTask?: string
  algorithm?: 'MatchTemplate' | 'JustReturn' | 'OcrDetect' | 'FeatureMatch'
  action?: 'DoNothing' | 'ClickSelf' | 'ClickRect' | 'Stop' | 'Swipe' | 'Input'
  sub?: MaaTaskExpr[]
  subErrorIgnored?: boolean
  next?: MaaTaskExpr[]
  maxTimes?: number
  exceededNext?: MaaTaskExpr[]
  onErrorNext?: MaaTaskExpr[]
  preDelay?: number
  postDelay?: number
  roi?: FlatRect
  cache?: boolean
  rectMove?: FlatRect
  reduceOtherTimes?: MaaTaskExpr[]
  specificRect?: FlatRect
  specialParams?: unknown[]
  highResolutionSwipeFix?: boolean
} & MaaTaskMatchTemplate &
  MaaTaskOcrDetect &
  MaaTaskFeatureMatch &
  MaaTaskInput

export type MaaTaskMatchTemplate = {
  template?: string | string[]
  templThreshold?: number | number[]
  maskRange?: [number, number]
  colorScales?: unknown // 麻烦的玩意，不写了
  colorWithClose?: boolean
  method?: 'Ccoeff' | 'RGBCount' | 'HSVCount'
}

export type MaaTaskOcrDetect = {
  text?: string[]
  ocrReplace?: [string, string][]
  fullMatch?: boolean
  isAscii?: boolean
  withoutDet?: boolean
  useRaw?: boolean
  binThreshold?: [number, number]
}

export type MaaTaskFeatureMatch = {
  template?: string | string[]
  count?: number
  ratio?: number
  detector?: 'SIFT' | 'ORB' | 'BRISK' | 'KAZE' | 'AKAZE'
}

// 文档里面写的是还必须是JustReturn，但是好像只有一个用例，随便了
export type MaaTaskInput = {
  inputText?: string
}

export type SpecialVirts = 'none' | 'self' | 'back'
export type PropsVirts = 'next' | 'sub' | 'exceeded_next' | 'on_error_next' | 'reduce_other_times'
export type AllVirts = SpecialVirts | PropsVirts
