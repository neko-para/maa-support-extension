export const enum Message {
  Task_Debug_ReadyToRun = 'Task.Debug.ReadyToRun',
  Task_Debug_Runout = 'Task.Debug.Runout',
  Task_Debug_Completed = 'Task.Debug.Completed',

  Task_Debug_ListToRecognize = 'Task.Debug.ListToRecognize',
  Task_Debug_RecognitionResult = 'Task.Debug.RecognitionResult',
  Task_Debug_Hit = 'Task.Debug.Hit',
  Task_Debug_MissAll = 'Task.Debug.MissAll'
}

type DebugMessage = {
  task_id: number
  entry: string
  hash: string
  uuid: string
  pre_hit_task: string
}

type DebugHitMessage = {
  name: string
  recognition: {
    box: [number, number, number, number]
    detail: string | null
    hit: boolean
    id: number
  }
}

type DebugNodeMessage = {
  node_id: number
  status: number // private status
}

export type DebugMessageDetail = {
  [Message.Task_Debug_ReadyToRun]: DebugMessage & DebugHitMessage & DebugNodeMessage
  [Message.Task_Debug_Completed]: DebugMessage & DebugHitMessage & DebugNodeMessage
  [Message.Task_Debug_Runout]: DebugMessage & DebugHitMessage & DebugNodeMessage
  [Message.Task_Debug_ListToRecognize]: DebugMessage & {
    list: string[]
  }
  [Message.Task_Debug_RecognitionResult]: DebugMessage & DebugHitMessage
  [Message.Task_Debug_Hit]: DebugMessage & DebugHitMessage
  [Message.Task_Debug_MissAll]: DebugMessage & {
    list: string[]
  }
}
