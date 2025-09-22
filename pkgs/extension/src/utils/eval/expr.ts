import { logger } from '@mse/utils'

import { declExpr, makeParser } from './simpleParser'
import { MaaTaskExpr } from './types'
import { AllVirtTaskProp } from './utils'

let parser: ReturnType<typeof buildParser> | null = null

function buildParser() {
  return makeParser(
    [
      [
        'virt',
        /(?:self|back|next|sub|on_error_next|exceeded_next|reduce_other_times)(?![a-zA-Z0-9_-])/
      ],
      // ['number', /\d+/], 有些task真的是全是数字, 太坏了
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
      }
      return false
    },
    declExpr<{
      parent: string
      parentList: string[]

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

      .for('parent')
        .when('%task', '%at')
          .do()

      .for('parentList')
        .when('parent')
          .do(([parent]) => [parent])
        .when('parent')
          .withloop()
            .when('parent').do()
          .do(([parent, parents]) => [parent, ...parents])

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
        .when('%sharp', '%virt')
          .do(([, virt]) => ({
            type: '#',
            virt: virt as AllVirtTaskProp
          }))
        .when('parentList', 'taskList4')
          .do(([parent, list]) => ({
            type: '@',
            parent,
            list
          }))
        .when('parentList', 'taskList4', '%sharp', '%virt')
          .do(([parent, list, , virt]) => ({
            type: '#',
            list: {
              type: '@',
              parent,
              list
            },
            virt: virt as AllVirtTaskProp
          }))
        .when('taskList4', '%sharp', '%virt')
          .do(([list, , virt]) => ({
            type: '#',
            list,
            virt: virt as AllVirtTaskProp
          }))

      .for('taskList2')
        .sameas('taskList3')
        .when('taskList3', '%multi', '%task')
          .do(([list, , count]) => ({
            type: '*',
            list,
            count: /\d+/.test(count) ? parseInt(count) : 0
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
      return `${ast.list ? buildExprImpl(ast.list) : ''}#${ast.virt}`
    case '@':
      return `${ast.parent.join('@')}@${buildExprImpl(ast.list)}`
    case '*':
      return `${buildExprImpl(ast.list)} * ${ast.count}`
    case '+':
      return `${buildExprImpl(ast.left)} + ${buildExprImpl(ast.right)}`
    case '^':
      return `${buildExprImpl(ast.left)} ^ ${buildExprImpl(ast.right)}`
  }
}

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
        parent,
        list: {
          type: 'task',
          task: ast.task
        }
      }
    case 'brace':
      return {
        type: 'brace',
        list: addParent(ast, parent)
      }
    case '#':
      if (ast.list) {
        if (ast.list.type === '@') {
          // A@B@ C@D#self -> A@B@C@D#self
          // 合并 parent
          return {
            type: '#',
            list: {
              type: '@',
              parent: [...parent, ...ast.list.parent],
              list: ast.list.list
            },
            virt: ast.virt
          }
        } else {
          // A@B@ C#self -> A@B@C#self
          // 添加 parent
          return {
            type: '#',
            list: {
              type: '@',
              parent,
              list: ast.list
            },
            virt: ast.virt
          }
        }
      } else {
        const last = parent.pop()!
        if (parent.length > 0) {
          // A@B@ #self -> A@B#self
          // 把最后一个变成 task
          return {
            type: '#',
            list: {
              type: '@',
              parent,
              list: {
                type: 'task',
                task: last
              }
            },
            virt: ast.virt
          }
        } else {
          // A@ #self -> A#self
          return {
            type: '#',
            list: {
              type: 'task',
              task: last
            },
            virt: ast.virt
          }
        }
      }
    case '@':
      return {
        type: '@',
        parent: [...parent, ...ast.parent],
        list: ast.list
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

export function addParentToExpr(expr: MaaTaskExpr, parent: string[]): MaaTaskExpr | null {
  const ast = parseExpr(expr)
  if (!ast) {
    return null
  }

  const newAst = addParent(ast, parent)
  return buildExpr(newAst)
}

export type MaaTaskExprAst = TaskList1

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
      type: '#'
      list?:
        | TaskList4
        | {
            type: '@'
            parent: string[]
            list: TaskList4
          }
      virt: AllVirtTaskProp
    }
  | {
      type: '@'
      parent: string[]
      list: TaskList4
    }

export type TaskList4 =
  | {
      type: 'task'
      task: string
    }
  | {
      type: 'brace'
      list: TaskList1
    }
