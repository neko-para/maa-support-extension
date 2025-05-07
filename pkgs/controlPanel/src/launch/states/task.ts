import { ref } from 'vue'

import { ipc } from '@/launch/main'
import {
  type ActionMessage,
  Message,
  type NextListMessage,
  type RecognitionMessage,
  type TaskMessage
} from '@/launch/types/msg'

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

type FocusNotify = {
  start?: string | string[]
  succeeded?: string | string[]
  failed?: string | string[]
  toast?: string
}

function parseNotify(data: unknown): FocusNotify {
  const result: FocusNotify = {}
  if (typeof data !== 'object' || data === null) {
    return {}
  }
  const check = (v: unknown): v is string | string[] => {
    return (
      typeof v === 'string' ||
      (Array.isArray(v) && v.map(x => typeof x === 'string').reduce((a, b) => a && b, true))
    )
  }
  if ('start' in data && check(data.start)) {
    result.start = data.start
  }
  if ('succeeded' in data && check(data.succeeded)) {
    result.succeeded = data.succeeded
  }
  if ('failed' in data && check(data.failed)) {
    result.failed = data.failed
  }
  if ('toast' in data && typeof data.toast === 'string') {
    result.toast = data.toast
  }
  return result
}

export class TaskList {
  info: TaskScope[] = []
  focus: string[] = []

  get lastInfo() {
    return this.info[this.info.length - 1]
  }

  get lastNLInfo() {
    return this.lastInfo.nexts[this.lastInfo.nexts.length - 1]
  }

  get lastRInfo() {
    return this.lastNLInfo.recos[this.lastNLInfo.recos.length - 1]
  }

  yieldFocus(v?: string | string[]) {
    if (v) {
      this.focus.push(...(typeof v === 'string' ? [v] : v))
    }
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
        {
          const notify = parseNotify((detail_ as NextListMessage).focus)
          this.yieldFocus(notify.start)
          if (notify.toast) {
            this.focus.push(`<toast> ${notify.toast}`)
          }
        }
        break
      case Message.Task_NextList_Succeeded:
        this.lastNLInfo.state = 'success'
        this.lastNLInfo.info = detail_ as NextListMessage
        this.yieldFocus(parseNotify((detail_ as NextListMessage).focus).succeeded)
        break
      case Message.Task_NextList_Failed:
        this.lastNLInfo.state = 'failed'
        this.lastNLInfo.info = detail_ as NextListMessage
        this.yieldFocus(parseNotify((detail_ as NextListMessage).focus).failed)
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
export const stopped = ref(false)

export function stop() {
  ipc.postMessage({
    cmd: 'stopLaunch'
  })
}
