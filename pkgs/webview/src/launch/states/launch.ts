import { produce } from 'immer'
import { shallowRef } from 'vue'

type GeneralStatus = 'running' | 'success' | 'failed'

export type TaskScope = {
  type: 'task'
  msg: maa.TaskerNotify
  status: GeneralStatus
  childs: PipelineNodeScope[]
}

export type PipelineNodeScope = {
  type: 'pipeline_node'
  msg: maa.TaskerContextPipelineNodeNotify
  status: GeneralStatus
  reco: NextListScope[]
  action: ActionScope | null
}

export type RecoNodeScope = {
  type: 'reco_node'
  msg: maa.TaskerContextRecognitionNodeNotify
  status: GeneralStatus
  reco: RecoScope | null
}

export type ActionNodeScope = {
  type: 'act_node'
  msg: maa.TaskerContextActionNodeNotify
  status: GeneralStatus
  action: ActionScope | null
}

export type NextListScope = {
  type: 'next'
  msg: maa.TaskerContextNextListNotify
  status: GeneralStatus
  childs: RecoScope[]
}

export type RecoScope = {
  type: 'reco'
  msg: maa.TaskerContextRecognitionNotify
  status: GeneralStatus
  childs: AnyNodeScope[]
}

export type ActionScope = {
  type: 'act'
  msg: maa.TaskerContextActionNotify
  status: GeneralStatus
  childs: AnyNodeScope[]
}

export type AnyNodeScope = PipelineNodeScope | RecoNodeScope | ActionNodeScope
export type AllScope = AnyNodeScope | NextListScope | RecoScope | ActionScope

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

function iterateTracker(tracker: AllScope): AllScope | undefined {
  switch (tracker.type) {
    case 'pipeline_node':
      if (tracker.action) {
        return tracker.action
      } else {
        return lastOf(tracker.reco)
      }
    case 'reco_node':
      return tracker.reco ?? undefined
    case 'act_node':
      return tracker.action ?? undefined
    case 'next':
      return lastOf(tracker.childs)
    case 'reco':
    case 'act':
      return lastOf(tracker.childs)
  }
}

export function reduceLaunchGraph(
  current: LaunchGraph,
  msg: maa.TaskerNotify | maa.TaskerContextNotify
) {
  return produce(current, current => {
    switch (msg.msg) {
      case 'Task.Starting':
        current.childs.push({
          type: 'task',
          msg,
          status: 'running',
          childs: []
        })
        current.depth = 0
        return
      case 'Task.Succeeded': {
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
        case 'PipelineNode.Starting':
          task.childs.push({
            type: 'pipeline_node',
            msg,
            status: 'running',
            reco: [],
            action: null
          })
          current.depth = current.depth + 1
          return
        case 'PipelineNode.Succeeded':
        case 'PipelineNode.Failed':
        case 'RecognitionNode.Starting':
        case 'RecognitionNode.Succeeded':
        case 'RecognitionNode.Failed':
        case 'ActionNode.Starting':
        case 'ActionNode.Succeeded':
        case 'ActionNode.Failed':
        case 'NextList.Starting':
        case 'NextList.Succeeded':
        case 'NextList.Failed':
        case 'Recognition.Starting':
        case 'Recognition.Succeeded':
        case 'Recognition.Failed':
        case 'Action.Starting':
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

      let tracker: AllScope = topScope
      for (let i = 1; i < current.depth; i++) {
        const newTracker = iterateTracker(tracker)
        if (!newTracker) {
          console.log('drop msg', msg, 'trace failed')
          return
        }
        tracker = newTracker
      }

      switch (msg.msg) {
        case 'PipelineNode.Starting':
          if (tracker.type === 'reco' || tracker.type === 'act') {
            tracker.childs.push({
              type: 'pipeline_node',
              msg,
              status: 'running',
              reco: [],
              action: null
            })
            current.depth = current.depth + 1
            return
          }
          break
        case 'PipelineNode.Succeeded':
        case 'PipelineNode.Failed':
          if (tracker.type === 'pipeline_node') {
            tracker.msg = msg
            tracker.status = msg.msg === 'PipelineNode.Succeeded' ? 'success' : 'failed'
            current.depth = current.depth - 1
            return
          }
          break

        case 'RecognitionNode.Starting':
          if (tracker.type === 'reco' || tracker.type === 'act') {
            tracker.childs.push({
              type: 'reco_node',
              msg,
              status: 'running',
              reco: null
            })
            current.depth = current.depth + 1
            return
          }
          break
        case 'RecognitionNode.Succeeded':
        case 'RecognitionNode.Failed':
          if (tracker.type === 'reco_node') {
            tracker.msg = msg
            tracker.status = msg.msg === 'RecognitionNode.Succeeded' ? 'success' : 'failed'
            current.depth = current.depth - 1
            return
          }
          break

        case 'ActionNode.Starting':
          if (tracker.type === 'reco' || tracker.type === 'act') {
            tracker.childs.push({
              type: 'act_node',
              msg,
              status: 'running',
              action: null
            })
            current.depth = current.depth + 1
            return
          }
          break
        case 'ActionNode.Succeeded':
        case 'ActionNode.Failed':
          if (tracker.type === 'act_node') {
            tracker.msg = msg
            tracker.status = msg.msg === 'ActionNode.Succeeded' ? 'success' : 'failed'
            current.depth = current.depth - 1
            return
          }
          break

        case 'NextList.Starting':
          if (tracker.type === 'pipeline_node') {
            tracker.reco.push({
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
        case 'NextList.Failed':
          if (tracker.type === 'next') {
            tracker.msg = msg
            tracker.status = msg.msg === 'NextList.Succeeded' ? 'success' : 'failed'
            current.depth = current.depth - 1
            return
          }
          break

        case 'Recognition.Starting':
          if (tracker.type === 'reco_node') {
            tracker.reco = {
              type: 'reco',
              msg,
              status: 'running',
              childs: []
            }
            current.depth = current.depth + 1
            return
          } else if (tracker.type === 'next') {
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
        case 'Recognition.Failed':
          if (tracker.type === 'reco') {
            tracker.msg = msg
            tracker.status = msg.msg === 'Recognition.Succeeded' ? 'success' : 'failed'
            current.depth = current.depth - 1
            return
          }
          break

        case 'Action.Starting':
          if (tracker.type === 'pipeline_node' || tracker.type === 'act_node') {
            tracker.action = {
              type: 'act',
              msg,
              status: 'running',
              childs: []
            }
            current.depth = current.depth + 1
            return
          }
          break
        case 'Action.Succeeded':
        case 'Action.Failed':
          if (tracker.type === 'act') {
            tracker.msg = msg
            tracker.status = msg.msg === 'Action.Succeeded' ? 'success' : 'failed'
            current.depth = current.depth - 1
            return
          }
          break
      }
      console.log('drop msg', msg)
    }
  })
}

export const launchGraph = shallowRef<LaunchGraph>({
  depth: 0,
  childs: []
})
