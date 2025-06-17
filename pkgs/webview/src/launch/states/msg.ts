export const enum Message {
  Tasker_Task_Starting = 'Tasker.Task.Starting',
  Tasker_Task_Succeeded = 'Tasker.Task.Succeeded',
  Tasker_Task_Failed = 'Tasker.Task.Failed',

  Task_NextList_Starting = 'Node.NextList.Starting',
  Task_NextList_Succeeded = 'Node.NextList.Succeeded',
  Task_NextList_Failed = 'Node.NextList.Failed',

  Task_Recognition_Starting = 'Node.Recognition.Starting',
  Task_Recognition_Succeeded = 'Node.Recognition.Succeeded',
  Task_Recognition_Failed = 'Node.Recognition.Failed',

  Task_Action_Starting = 'Node.Action.Starting',
  Task_Action_Succeeded = 'Node.Action.Succeeded',
  Task_Action_Failed = 'Node.Action.Failed'
}

export type TaskMessage = {
  task_id: number
  entry: string
  uuid: string
  hash: string
}

export type NextListMessage = {
  task_id: number
  name: string
  list: string[]
  focus: unknown
}

export type RecognitionMessage = {
  task_id: number
  reco_id: number
  name: string
}

export type ActionMessage = {
  task_id: number
  node_id: number
  name: string
}
