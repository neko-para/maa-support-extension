import { computed, ref } from 'vue'

import { hostState } from '../state'
import {
  type ActionMessage,
  Message,
  type NextListMessage,
  type RecognitionMessage,
  type TaskMessage
} from './msg'

export type TaskScope = {
  info: TaskMessage
  state: 'running' | 'success' | 'failed'
  nexts: NextListScope[]
}

export type NextListScope = {
  info: NextListMessage
  state: 'running' | 'success' | 'failed'
  recos: RecoScope[]
  act: ActionScope | null

  id: number
  __fin?: boolean
}

type RecoScope = {
  info: RecognitionMessage
  state: 'running' | 'success' | 'failed'
  scopes: NextListScope[]
}

type ActionScope = {
  info: ActionMessage
  state: 'running' | 'success' | 'failed'
  scopes: NextListScope[]
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

  scopeStack: NextListScope[][] = []

  counter = 0

  get lastInfo() {
    return this.info[this.info.length - 1]
  }

  get lastScope() {
    return this.scopeStack[0]
  }

  get lastNLInfo() {
    return this.lastScope[this.lastScope.length - 1]
  }

  get lastRInfo() {
    return this.lastNLInfo.recos[this.lastNLInfo.recos.length - 1]
  }

  yieldFocus(v?: string | string[]) {
    if (v) {
      this.focus.push(...(typeof v === 'string' ? [v] : v))
    }
  }

  rename(detail: TaskMessage): TaskMessage {
    if (detail.entry.endsWith('::post_stop()')) {
      return {
        ...detail,
        entry: '$POST_STOP'
      }
    } else {
      return detail
    }
  }

  popScope() {
    const scope = this.scopeStack.shift()
    if (scope?.[0]) {
      scope[0].__fin = true
    }
  }

  push(msg: Message, detail_: unknown) {
    switch (msg) {
      case Message.Tasker_Task_Starting:
        this.info.push({
          info: this.rename(detail_ as TaskMessage),
          state: 'running',
          nexts: []
        })
        this.scopeStack.unshift(this.lastInfo.nexts)
        break
      case Message.Tasker_Task_Succeeded:
        this.popScope()
        this.lastInfo.state = 'success'
        this.lastInfo.info = this.rename(detail_ as TaskMessage)
        break
      case Message.Tasker_Task_Failed:
        this.popScope()
        this.lastInfo.state = 'failed'
        this.lastInfo.info = this.rename(detail_ as TaskMessage)
        break

      case Message.Task_NextList_Starting:
        this.lastScope.push({
          info: detail_ as NextListMessage,
          state: 'running',
          recos: [],
          act: null,

          id: this.counter++
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
        this.yieldFocus(parseNotify((detail_ as NextListMessage).focus).succeeded)
        this.lastNLInfo.state = 'success'
        this.lastNLInfo.info = detail_ as NextListMessage
        break
      case Message.Task_NextList_Failed:
        this.yieldFocus(parseNotify((detail_ as NextListMessage).focus).failed)
        this.lastNLInfo.state = 'failed'
        this.lastNLInfo.info = detail_ as NextListMessage
        break

      case Message.Task_Recognition_Starting:
        this.lastNLInfo.recos.push({
          info: detail_ as RecognitionMessage,
          state: 'running',
          scopes: []
        })
        this.scopeStack.unshift(this.lastNLInfo.recos[this.lastNLInfo.recos.length - 1].scopes)
        break
      case Message.Task_Recognition_Succeeded:
        this.popScope()
        this.lastRInfo.state = 'success'
        this.lastRInfo.info = detail_ as RecognitionMessage
        break
      case Message.Task_Recognition_Failed:
        this.popScope()
        this.lastRInfo.state = 'failed'
        this.lastRInfo.info = detail_ as RecognitionMessage
        break

      case Message.Task_Action_Starting:
        this.lastNLInfo.act = {
          info: detail_ as ActionMessage,
          state: 'running',
          scopes: []
        }
        this.scopeStack.unshift(this.lastNLInfo.act.scopes)
        break
      case Message.Task_Action_Succeeded:
        this.popScope()
        this.lastNLInfo.act!.state = 'success'
        this.lastNLInfo.act!.info = detail_ as ActionMessage
        break
      case Message.Task_Action_Failed:
        this.popScope()
        this.lastNLInfo.act!.state = 'failed'
        this.lastNLInfo.act!.info = detail_ as ActionMessage
        break
    }
  }
}

export const taskList = ref(new TaskList())

export const followLast = ref(true)
const selectTask = ref(0)
export const activeTask = computed<string | number | undefined>({
  get() {
    if (followLast.value && !hostState.value.stopped) {
      return taskList.value.info.length > 0 ? taskList.value.info.length - 1 : undefined
    } else {
      return selectTask.value
    }
  },
  set(v) {
    if (typeof v !== 'number') {
      return
    }
    selectTask.value = v
    followLast.value = false
  }
})
