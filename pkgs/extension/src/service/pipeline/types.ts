import * as vscode from 'vscode'

export type QueryResult =
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

export type TaskIndexInfo = {
  uri: vscode.Uri
  taskContent: string
  taskReferContent: string // whole lines
  taskProp: vscode.Range
  taskBody: vscode.Range
  taskRef: {
    task: string
    range: vscode.Range
    belong: 'next' | 'target'
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
}
