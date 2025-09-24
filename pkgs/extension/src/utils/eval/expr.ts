import { logger } from '@mse/utils'
import { declExpr, makeParser } from '@nekosu/simple-parser'

import { MaaTaskExpr } from './types'
import { AllVirtTaskProp } from './utils'

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
            virt: virt as AllVirtTaskProp
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
        .when('taskList2', '%plus', 'taskList2')
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

export function parseExpr(expr: MaaTaskExpr): MaaTaskExprAst | null {
  if (!parser) {
    parser = buildParser()
  }

  try {
    return parser.parse(expr)
  } catch (err) {
    logger.error(`parse expr failed ${expr} error ${err}`)
    return null
  }
}

export function buildExpr(ast: MaaTaskExprAst): MaaTaskExpr {
  return buildExprImpl(ast) as MaaTaskExpr
}

function buildExprImpl(ast: MaaTaskExprAst): string {
  switch (ast.type) {
    case 'task':
      return ast.task
    case 'brace':
      return `(${buildExprImpl(ast.list)})`
    case '#':
      return `#${ast.virt}`
    case '@':
      return ast.list.map(expr => buildExprImpl(expr)).join('@') + (ast.virt ? `#${ast.virt}` : '')
    case '*':
      return `${buildExprImpl(ast.list)} * ${ast.count}`
    case '+':
      return `${buildExprImpl(ast.left)} + ${buildExprImpl(ast.right)}`
    case '^':
      return `${buildExprImpl(ast.left)} ^ ${buildExprImpl(ast.right)}`
  }
}

/*
export function addParent(ast: TaskList3 | TaskList4, parent: string[]): TaskList3
export function addParent(ast: TaskList2, parent: string[]): TaskList2
export function addParent(ast: TaskList1, parent: string[]): TaskList1
export function addParent(ast: MaaTaskExprAst, parent: string[]): MaaTaskExprAst {
  if (parent.length === 0) {
    return JSON.parse(JSON.stringify(ast))
  }
  parent = [...parent]

  switch (ast.type) {
    case 'task':
      return {
        type: '@',
        list: [
          ...parent.map(
            task =>
              ({
                type: 'task',
                task
              }) satisfies TaskList4
          ),
          {
            type: 'task',
            task: ast.task
          }
        ]
      }
    case 'brace':
      return {
        type: 'brace',
        list: addParent(ast, parent)
      }
    case '#':
      return {
        type: '@',
        list: parent.map(task => ({
          type: 'task',
          task
        })),
        virt: ast.virt
      }
    case '@':
      return {
        type: '@',
        list: [
          ...parent.map(
            task =>
              ({
                type: 'task',
                task
              }) satisfies TaskList4
          ),
          ...ast.list
        ],
        virt: ast.virt
      }
    case '*':
      return {
        type: '*',
        list: addParent(ast.list, parent),
        count: ast.count
      }
    case '+':
      return {
        type: '+',
        left: addParent(ast.left, parent),
        right: addParent(ast.right, parent)
      }
    case '^':
      return {
        type: '^',
        left: addParent(ast.left, parent),
        right: addParent(ast.right, parent)
      }
  }
}
*/

export function addParentToExpr(expr: MaaTaskExpr, parent: string[]): MaaTaskExpr | null {
  // const ast = parseExpr(expr)
  // if (!ast) {
  //   return null
  // }

  // const newAst = addParent(ast, parent)
  // return buildExpr(newAst)
  // 这就是 MAA
  return (parent.join('@') + expr) as MaaTaskExpr
}

export type MaaTaskExprAst = TaskList1

export type TaskVirt = {
  type: '#'
  virt: AllVirtTaskProp
}

export type TaskList1 =
  | TaskList2
  | {
      type: '+' | '^'
      left: TaskList2
      right: TaskList2
    }

export type TaskList2 =
  | TaskList3
  | {
      type: '*'
      list: TaskList3
      count: number
    }

export type TaskList3 =
  | TaskList4
  | {
      type: '@'
      list: AtTaskList
      virt?: AllVirtTaskProp
    }
  | TaskVirt

export type AtTaskList = TaskList4[]

export type TaskList4 =
  | {
      type: 'task'
      task: string
    }
  | {
      type: 'brace'
      list: TaskList1
    }
