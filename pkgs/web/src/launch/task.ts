import { ref } from 'vue'

import {
  type ActionMessage,
  Message,
  type NextListMessage,
  type RecognitionMessage,
  type TaskMessage
} from '../msg'

type TaskScope = {
  info: TaskMessage
  state: 'running' | 'success' | 'failed'
  nexts: NextListScope[]
}

type NextListScope = {
  info: NextListMessage
  state: 'running' | 'success' | 'failed'
  recos: RecoScope[]
  act: ActionScope | null
}

type RecoScope = {
  info: RecognitionMessage
  state: 'running' | 'success' | 'failed'
}

type ActionScope = {
  info: ActionMessage
  state: 'running' | 'success' | 'failed'
}

export class TaskList {
  info: TaskScope[] = []

  get lastInfo() {
    return this.info[this.info.length - 1]
  }

  get lastNLInfo() {
    return this.lastInfo.nexts[this.lastInfo.nexts.length - 1]
  }

  get lastRInfo() {
    return this.lastNLInfo.recos[this.lastNLInfo.recos.length - 1]
  }

  push(msg: Message, detail_: unknown) {
    switch (msg) {
      case Message.Tasker_Task_Starting:
        this.info.push({
          info: detail_ as TaskMessage,
          state: 'running',
          nexts: []
        })
        break
      case Message.Tasker_Task_Succeeded:
        this.lastInfo.state = 'success'
        this.lastInfo.info = detail_ as TaskMessage
        break
      case Message.Tasker_Task_Failed:
        this.lastInfo.state = 'failed'
        this.lastInfo.info = detail_ as TaskMessage
        break

      case Message.Task_NextList_Starting:
        this.lastInfo.nexts.push({
          info: detail_ as NextListMessage,
          state: 'running',
          recos: [],
          act: null
        })
        break
      case Message.Task_NextList_Succeeded:
        this.lastNLInfo.state = 'success'
        this.lastNLInfo.info = detail_ as NextListMessage
        break
      case Message.Task_NextList_Failed:
        this.lastNLInfo.state = 'failed'
        this.lastNLInfo.info = detail_ as NextListMessage
        break

      case Message.Task_Recognition_Starting:
        this.lastNLInfo.recos.push({
          info: detail_ as RecognitionMessage,
          state: 'running'
        })
        break
      case Message.Task_Recognition_Succeeded:
        this.lastRInfo.state = 'success'
        this.lastRInfo.info = detail_ as RecognitionMessage
        break
      case Message.Task_Recognition_Failed:
        this.lastRInfo.state = 'failed'
        this.lastRInfo.info = detail_ as RecognitionMessage
        break

      case Message.Task_Action_Starting:
        this.lastNLInfo.act = {
          info: detail_ as ActionMessage,
          state: 'running'
        }
        break
      case Message.Task_Action_Succeeded:
        this.lastNLInfo.act!.state = 'success'
        this.lastNLInfo.act!.info = detail_ as ActionMessage
        break
      case Message.Task_Action_Failed:
        this.lastNLInfo.act!.state = 'failed'
        this.lastNLInfo.act!.info = detail_ as ActionMessage
        break
    }
  }
}

export const taskList = ref(new TaskList())
