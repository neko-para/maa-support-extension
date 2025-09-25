import { declExpr, makeParser } from '@nekosu/simple-parser'

import type { AllVirts } from '../types'
import type { AtTaskList, TaskList1, TaskList2, TaskList3, TaskList4, TaskVirt } from './types'

let parser: ReturnType<typeof buildParser> | null = null

function buildParser() {
  return makeParser(
    [
      [
        'virt',
        /(?:none|self|back|next|sub|on_error_next|exceeded_next|reduce_other_times)(?![a-zA-Z0-9_-])/
      ],
      ['number', /\d+/],
      ['task', /[a-zA-Z0-9_-]+/],
      ['sharp', /#/],
      ['at', /@/],
      ['multi', /\*/],
      ['plus', /\+/],
      ['diff', /\^/],
      ['leftBrace', /\(/],
      ['rightBrace', /\)/]
    ] as const,
    (curr, getBack) => {
      if (curr === '%virt') {
        return getBack(0) !== '%sharp'
      } else if (curr === '%number') {
        return getBack(0) !== '%multi'
      }
      return false
    },
    declExpr<{
      parent: string
      parentList: string[]

      taskVirt: TaskVirt
      atTaskList: AtTaskList

      taskList4: TaskList4
      taskList3: TaskList3
      taskList2: TaskList2
      taskList1: TaskList1
    }>(),
    /[ \t\n]+/,
    rule => {
      // prettier-ignore
      return rule
      .entry('taskList1')
        .do()

      .for('taskVirt')
        .when('%sharp', '%virt')
          .do(([, virt]) => ({
            type: '#',
            virt: virt as AllVirts
          }))

      .for('atTaskList')
        .when('taskList4')
          .withloop()
            .when('%at', 'taskList4')
              .do(([, task]) => (task))
            .do(([task, tasks]) => [task, ...tasks])

      .for('taskList4')
        .when('%task')
          .do(([task]) => ({
            type: 'task',
            task
          }))
        .when('%leftBrace', 'taskList1', '%rightBrace')
          .do(([, list]) => ({
            type: 'brace',
            list
          }))

      .for('taskList3')
        .sameas('taskList4')
        .when('taskList4', 'taskVirt')
          .do(([list, virt]) => ({
            type: '@',
            list: [list],
            virt: virt.virt
          }))
        .sameas('taskVirt')
        .when('atTaskList', 'taskVirt')
          .do(([list, virt]) => ({
            type: '@',
            list,
            virt: virt.virt
          }))
        .when('atTaskList')
          .do(([list]) => ({
            type: '@',
            list
          }))

      .for('taskList2')
        .sameas('taskList3')
        .when('taskList3', '%multi', '%number')
          .do(([list, , count]) => ({
            type: '*',
            list,
            count: parseInt(count)
          }))

      .for('taskList1')
        .sameas('taskList2')
        .when('taskList2', '%plus', 'taskList1')
          .do(([left, , right]) => ({
            type: '+',
            left,
            right
          }))
        .when('taskList2', '%diff', 'taskList2')
          .do(([left, , right]) => ({
            type: '^',
            left,
            right
          }))
    }
  )
}

export function getParser() {
  if (!parser) {
    parser = buildParser()
  }
  return parser
}
