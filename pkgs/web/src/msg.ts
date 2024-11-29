export const enum Message {
  Tasker_Task_Starting = 'Tasker.Task.Starting',
  Tasker_Task_Succeeded = 'Tasker.Task.Succeeded',
  Tasker_Task_Failed = 'Tasker.Task.Failed',

  Task_NextList_Starting = 'Task.NextList.Starting',
  Task_NextList_Succeeded = 'Task.NextList.Succeeded',
  Task_NextList_Failed = 'Task.NextList.Failed',

  Task_Recognition_Starting = 'Task.Recognition.Starting',
  Task_Recognition_Succeeded = 'Task.Recognition.Succeeded',
  Task_Recognition_Failed = 'Task.Recognition.Failed',

  Task_Action_Starting = 'Task.Action.Starting',
  Task_Action_Succeeded = 'Task.Action.Succeeded',
  Task_Action_Failed = 'Task.Action.Failed'
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
