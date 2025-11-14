import { type WritableDraft, produce } from 'immer'

type TaskerContextNextListNotify = {
  msg: 'NextList.Starting' | 'NextList.Succeeded' | 'NextList.Failed'
  task_id: number // TaskId
  name: string
  list: string[]
  focus: unknown
}

type TaskerContextRecognitionNotify = {
  msg: 'Recognition.Starting' | 'Recognition.Succeeded' | 'Recognition.Failed'
  task_id: number // TaskId
  reco_id: number // RecoId
  name: string
  focus: unknown
}

type TaskerContextActionNotify = {
  msg: 'Action.Starting' | 'Action.Succeeded' | 'Action.Failed'
  task_id: number // TaskId
  action_id: number // ActId
  name: string
  focus: unknown
}

type GeneralStatus = 'running' | 'success' | 'failed'

export type TaskScope = {
  type: 'task'
  msg: maa.TaskerNotify
  status: GeneralStatus
  childs: AnyContextScope[]
}

export type NextListScope = {
  type: 'next'
  msg: TaskerContextNextListNotify
  status: GeneralStatus
  childs: RecoScope[]
}

export type RecoScope = {
  type: 'reco'
  msg: TaskerContextRecognitionNotify
  status: GeneralStatus
  childs: AnyContextScope[]
}

export type ActionScope = {
  type: 'act'
  msg: TaskerContextActionNotify
  status: GeneralStatus
  childs: AnyContextScope[]
}

export type AnyContextScope = NextListScope | RecoScope | ActionScope

export type LaunchGraph = {
  depth: number
  childs: TaskScope[]
}

function lastOf<T>(arr: T[]): T | undefined {
  if (arr.length === 0) {
    return undefined
  } else {
    return arr[arr.length - 1]
  }
}

export function reduceLaunchGraph(
  current: LaunchGraph,
  msg: maa.TaskerNotify | maa.TaskerContextNotify
) {
  return produce(current, current => {
    switch (msg.msg) {
      case 'Task.Started':
        current.childs.push({
          type: 'task',
          msg,
          status: 'running',
          childs: []
        })
        current.depth = 0
        return
      case 'Task.Completed': {
        const task = lastOf(current.childs)
        if (task) {
          task.msg = msg
          task.status = 'success'
        }
        return
      }
      case 'Task.Failed': {
        const task = lastOf(current.childs)
        if (task) {
          task.msg = msg
          task.status = 'failed'
        }
        return
      }
    }

    const task = lastOf(current.childs)
    if (!task) {
      console.log('drop msg', msg, 'no task')
      return
    }

    if (current.depth === 0) {
      switch (msg.msg) {
        case 'NextList.Starting':
          task.childs.push({
            type: 'next',
            msg,
            status: 'running',
            childs: []
          })
          current.depth = current.depth + 1
          return
        case 'Action.Starting':
          task.childs.push({
            type: 'act',
            msg,
            status: 'running',
            childs: []
          })
          current.depth = current.depth + 1
          return
        case 'NextList.Succeeded':
        case 'NextList.Failed':
        case 'Recognition.Starting':
        case 'Recognition.Succeeded':
        case 'Recognition.Failed':
        case 'Action.Succeeded':
        case 'Action.Failed':
          console.log('drop msg', msg, 'no root')
          return
      }
    } else {
      const topScope = lastOf(task.childs)
      if (!topScope) {
        console.log('drop msg', msg, 'no root')
        return
      }

      let tracker:
        | WritableDraft<NextListScope>
        | WritableDraft<RecoScope>
        | WritableDraft<ActionScope> = topScope

      for (let i = 1; i < current.depth; i++) {
        switch (tracker.type) {
          case 'next':
          case 'reco':
          case 'act': {
            const lastScope:
              | WritableDraft<NextListScope>
              | WritableDraft<RecoScope>
              | WritableDraft<ActionScope>
              | undefined = lastOf(tracker.childs)
            if (!lastScope) {
              console.log('drop msg', msg, 'tracing no last scope')
              return
            }
            tracker = lastScope
            break
          }
        }
      }

      switch (msg.msg) {
        case 'NextList.Starting':
          if (tracker.type === 'next') {
            break
          } else if (tracker.type === 'reco' || tracker.type === 'act') {
            tracker.childs.push({
              type: 'next',
              msg,
              status: 'running',
              childs: []
            })
            current.depth = current.depth + 1
            return
          }
          break
        case 'NextList.Succeeded':
          if (tracker.type === 'next') {
            tracker.msg = msg
            tracker.status = 'success'
            current.depth = current.depth - 1
            return
          } else if (tracker.type === 'reco' || tracker.type === 'act') {
            break
          }
          break
        case 'NextList.Failed':
          if (tracker.type === 'next') {
            tracker.msg = msg
            tracker.status = 'failed'
            current.depth = current.depth - 1
            return
          } else if (tracker.type === 'reco' || tracker.type === 'act') {
            break
          }
          break
        case 'Recognition.Starting':
          if (tracker.type === 'next' || tracker.type === 'reco' || tracker.type === 'act') {
            tracker.childs.push({
              type: 'reco',
              msg,
              status: 'running',
              childs: []
            })
            current.depth = current.depth + 1
            return
          }
          break
        case 'Recognition.Succeeded':
          if (tracker.type === 'reco') {
            tracker.msg = msg
            tracker.status = 'success'
            current.depth = current.depth - 1
            return
          }
          break
        case 'Recognition.Failed':
          if (tracker.type === 'reco') {
            tracker.msg = msg
            tracker.status = 'failed'
            current.depth = current.depth - 1
            return
          }
          break
        case 'Action.Starting':
          if (tracker.type === 'reco' || tracker.type === 'act') {
            tracker.childs.push({
              type: 'act',
              msg,
              status: 'running',
              childs: []
            })
            current.depth = current.depth + 1
            return
          }
          break
        case 'Action.Succeeded':
          if (tracker.type === 'act') {
            tracker.msg = msg
            tracker.status = 'success'
            current.depth = current.depth - 1
            return
          }
          break
        case 'Action.Failed':
          if (tracker.type === 'act') {
            tracker.msg = msg
            tracker.status = 'failed'
            current.depth = current.depth - 1
            return
          }
          break
      }
      console.log('drop msg', msg)
    }
  })
}
