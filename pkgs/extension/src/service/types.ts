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
      type: 'option.ref' | 'option.ref.advanced'
      range: vscode.Range
      option: string
    }
  | {
      type: 'case.ref'
      range: vscode.Range
      option: string
      case: string
    }

export type TaskIndexInfo = {
  uri: vscode.Uri
  taskContent: string
  taskReferContent: string // whole lines
  taskProp: vscode.Range
  taskBody: vscode.Range
  taskRef: {
    task: string
    range: vscode.Range
    belong: TaskBelong
    fake?: 'maa.#' | 'maa.@' // 虚假任务，供补全
  }[]
  imageRef: {
    path: string
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
