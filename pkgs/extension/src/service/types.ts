import * as vscode from 'vscode'

export type TaskBelong = 'target' | 'next' | 'maa.custom'

export type TaskQueryResult =
  | {
      type: 'task.prop'
      task: string
      range: vscode.Range
      target: string // equal to task
    }
  | {
      type: 'task.ref'
      task: string
      range: vscode.Range
      target: string
      attr?: boolean
    }
  | {
      type: 'image.ref'
      task: string
      range: vscode.Range
      target: string
    }
  | {
      type: 'task.body'
      task: string
      range: vscode.Range
    }
  | {
      type: 'anchor.def'
      task: string
      range: vscode.Range
      target: string
    }
  | {
      type: 'anchor.ref'
      task: string
      range: vscode.Range
      target: string
    }
  | {
      type: 'task.ref.maa.#'
      task: string
      range: vscode.Range
      target: string
    }
  | {
      type: 'task.ref.maa.@'
      task: string
      range: vscode.Range
      target: string
    }

export type InterfaceQueryResult =
  | {
      type: 'option.ref'
      range: vscode.Range
      option: string
    }
  | {
      type: 'case.ref'
      range: vscode.Range
      option: string
      case: string
    }
  | {
      type: 'locale.ref'
      range: vscode.Range
      value: string
    }

export type TaskIndexInfo = {
  uri: vscode.Uri
  taskContent: string
  taskReferContent: string // whole lines
  taskProp: vscode.Range
  taskBody: vscode.Range
  anchor?: {
    name: string
    range: vscode.Range
  }
  taskRef: {
    task: string
    range: vscode.Range
    belong: TaskBelong
    attr?: boolean
    fake?: 'maa.#' | 'maa.@' // 虚假任务，供补全
  }[]
  imageRef: {
    path: string
    range: vscode.Range
  }[]
  anchorRef: {
    anchor: string
    range: vscode.Range
  }[]
}

export interface PipelineLayer {
  uri: vscode.Uri
  level: number
  index: Record<string, TaskIndexInfo[]>
  images: {
    uri: vscode.Uri
    relative: string // abc/def/ghi.png
  }[]

  flushDirty(): Promise<void>
  flushImage(): Promise<void>
}
