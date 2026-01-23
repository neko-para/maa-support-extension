import { Range } from '@nekosu/simple-parser'

import type { AllVirts } from '../types'

export type MaaTaskExprAst = TaskList1

export type TaskVirt = {
  type: '#'
  virt: AllVirts
  range: Range
}

export type TaskList1 =
  | TaskList2
  | {
      type: '+' | '^'
      left: TaskList2
      right: TaskList1
    }

export type TaskList2 =
  | TaskList3
  | {
      type: '*'
      list: TaskList3
      count: number
      range: Range
    }

export type TaskList3 =
  | TaskList4
  | {
      type: '@'
      list: AtTaskList
      virt?: AllVirts
    }
  | TaskVirt

export type AtTaskList = TaskList4[]

export type TaskList4 =
  | {
      type: 'task'
      task: string
      range: Range
    }
  | {
      type: 'brace'
      list: TaskList1
    }
