import type { HostStateBase } from './base'

export type CropSettings = {
  saveAddRoiInfo?: boolean
  saveDir?: string
  selectFill?: string
  selectOpacity?: number
  selectOutlineOnly?: boolean
  selectOutlineThickness?: number
  revertScale?: boolean
  pointerAxesStroke?: string
  helperAxesStroke?: string
  helperAxesOpacity?: number
  helperAxesOverflow?: boolean
  helperAxesRadius?: number
  helperAxesThreshold?: number
  pickColorThreshold?: number
  templateMatchThreshold?: number
  recoStroke?: string
  recoFont?: string
  /** 右栏显示的面板，未设置时为识别测试面板 */
  sidePanel?: 'test' | 'color' | 'mask' | 'calc' | 'export' | 'settings' | 'hidden'
  /** 识别测试上次选中的目标 */
  testTarget?: 'ocr' | 'template' | 'color' | 'node'
  /** 节点试跑的 ROI 来源；未设置时用节点自己的 ROI */
  nodeRoiSource?: 'node' | 'canvas'
  /** 复制 pipeline 片段使用的协议版本（v1 平铺 / v2 纵深） */
  pipelineVersion?: 'v1' | 'v2'
  /** 右栏宽度（px），拖拽调整 */
  panelWidth?: number
  /** 右栏是否以悬浮窗显示（PS 面板式） */
  panelFloat?: boolean
  /** 悬浮窗位置与尺寸；h 省略时按内容自适应 */
  floatRect?: { x: number; y: number; w: number; h?: number }
}

export type CropHostState = HostStateBase & CropSettings

/** 一次性的颜色匹配参数，对应 Pipeline `ColorMatch` 的 `method` / `lower` / `upper` / `count` / `connected` */
export type ColorMatchOptions = {
  roi: maa.Rect
  method: 4 | 40 | 6
  /** 与 method 通道数一致的颜色下限，允许多个区间（HSV 色相跨 0 时需要） */
  lower: number[][]
  /** 与 method 通道数一致的颜色上限，允许多个区间（HSV 色相跨 0 时需要） */
  upper: number[][]
  count: number
  connected: boolean
}

/**
 * 工具面板一次识别的结果。
 * - `detail`: 识别详情 JSON（`maa.RecoDetailWithoutDraws`），识别未命中时也可能有值（`hit: false`）
 * - `failure`: 宿主已本地化的失败信息，webview 直接展示
 */
export type CropToolResult = {
  detail: string | null
  failure?: {
    message: string
  }
}

/** 截图/上传等返回单张图像的操作结果；失败原因已由宿主本地化 */
export type CropImageResult = {
  image: string | null
  failure?: {
    message: string
  }
}

/** 保存裁剪结果；`path` 为最终写盘路径（用户取消时为 null 消息，不返回该结构） */
export type CropSaveResult = {
  path: string | null
  /** 相对当前资源目录的路径（用于生成 `template` 片段），无资源时为 null */
  relativePath?: string | null
  failure?: {
    message: string
  }
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
  | {
      command: 'setRecoDetail'
      detail: maa.RecoDetailWithoutDraws
    }

export type CropWebToHost =
  | {
      // return CropImageResult
      command: 'requestScreencap'
    }
  | {
      // return CropImageResult | null，null 表示用户取消
      command: 'requestUpload'
    }
  | {
      // return string | null
      command: 'requestPickFolder'
    }
  | {
      // return CropSaveResult | null，null 表示用户取消
      command: 'requestSave'
      image: string
      crop: maa.Rect
      roi: maa.Rect
      expandRoi: maa.Rect
      /** 导出面板填写的文件名（不含扩展名）；缺省时宿主弹出输入框 */
      filename?: string
    }
  | {
      // return string | null
      command: 'resize'
      image: string
      width: number
      height: number
    }
  | {
      // return CropToolResult
      command: 'requestOCR'
      image: string
      roi: maa.Rect
      only_rec: boolean
    }
  | {
      // return CropToolResult | null，null 表示用户取消选择模板文件
      command: 'requestTemplateMatch'
      image: string
      roi: maa.Rect
      method: 10001 | 3 | 5
      threshold: number
      green_mask: boolean
    }
  | {
      // return CropToolResult | null，null 表示用户取消选择节点
      command: 'requestReco'
      image: string
      /** 提供时覆盖节点的 roi 字段；缺省时按节点自己的 ROI 识别 */
      roi?: maa.Rect
    }
  | {
      // return CropToolResult
      command: 'requestColorMatch'
      image: string
      options: ColorMatchOptions
    }
  | {
      // return void
      command: 'requestReveal'
      path: string
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
