import { computed } from 'vue'

import { ipc } from '@/control/main'
import * as interfaceSt from '@/control/states/interface'

export const addTaskName = computed<string | undefined>({
  set(v) {
    if (v) {
      ipc.context.value.interfaceAddTask = v
    }
  },
  get() {
    return ipc.context.value.interfaceAddTask
  }
})

export function add() {
  const taskName = addTaskName.value
  if (!taskName) {
    return
  }

  const taskDesc = interfaceSt.currentObj.value.task?.find(x => x.name === taskName)
  if (!taskDesc) {
    return
  }

  if (!interfaceSt.currentConfigObj.value.task) {
    interfaceSt.currentConfigObj.value.task = []
  }
  interfaceSt.currentConfigObj.value.task.push({
    name: taskName,
    option: []
  })
}

export function del(idx: number) {
  interfaceSt.currentConfigObj.value.task?.splice(idx, 1)
}

export function move(idx: number, dir: 'up' | 'down') {
  const tasks = interfaceSt.currentConfigObj.value.task
  if (tasks) {
    const task = tasks.splice(idx, 1)[0]
    if (task) {
      tasks.splice(dir === 'up' ? idx - 1 : idx + 1, 0, task)
    }
  }
}
