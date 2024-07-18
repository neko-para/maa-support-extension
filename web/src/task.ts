import { ref } from 'vue'

import { type DebugMessageDetail, Message } from './msg'

type TaskNode = {
  task_id: number
  pre_hit_task: string
  reco_list: {
    task: string
    status: 'success' | 'failed' | 'pending'
    reco_id?: number
  }[]
  hit?: string
  status: 'pending' | 'running' | 'success' | 'failed'
}

export class TaskList {
  node: TaskNode[] = []

  push<M extends Message>(msg: M, detail_: DebugMessageDetail[M]) {
    switch (msg) {
      case Message.Task_Debug_ListToRecognize: {
        const detail = detail_ as DebugMessageDetail[Message.Task_Debug_ListToRecognize]
        this.node.push({
          task_id: detail.task_id,
          pre_hit_task: detail.pre_hit_task,
          reco_list: detail.list.map(task => ({
            task,
            status: 'pending'
          })),
          status: 'pending'
        })
        break
      }
      case Message.Task_Debug_RecognitionResult: {
        const detail = detail_ as DebugMessageDetail[Message.Task_Debug_RecognitionResult]
        if (!this.node.length) {
          return
        }
        const n = this.node[this.node.length - 1]
        for (const r of n.reco_list) {
          if (r.task === detail.name) {
            r.status = detail.recognition.hit ? 'success' : 'failed'
            r.reco_id = detail.recognition.id
          }
        }
        break
      }
      case Message.Task_Debug_Hit: {
        const detail = detail_ as DebugMessageDetail[Message.Task_Debug_Hit]
        if (!this.node.length) {
          return
        }
        const n = this.node[this.node.length - 1]
        n.hit = detail.name
        break
      }
      case Message.Task_Debug_ReadyToRun: {
        if (!this.node.length) {
          return
        }
        const n = this.node[this.node.length - 1]
        n.status = 'running'
        break
      }
      case Message.Task_Debug_Completed: {
        if (!this.node.length) {
          return
        }
        const n = this.node[this.node.length - 1]
        n.status = 'success'
        break
      }
      case Message.Task_Debug_Runout: {
        if (!this.node.length) {
          return
        }
        const n = this.node[this.node.length - 1]
        n.status = 'failed'
        break
      }
      case Message.Task_Debug_MissAll: {
        if (!this.node.length) {
          return
        }
        const n = this.node[this.node.length - 1]
        n.status = 'failed'
        break
      }
    }
  }
}

export const taskList = ref(new TaskList())
