import type { Node } from 'jsonc-parser'

import type { AnchorName, ImageRelativePath, TaskName } from '../types'
import { parseTreeWithoutParent } from '../utils/json'
import {
  type StringNode,
  eachOrOne,
  isBool,
  isNumber,
  isString,
  parseArray,
  parseObject as parseObj,
  parseObjectFlex
} from '../utils/parse'
import { parseAttr } from './attr'
import { parseMaaTaskNode } from './maa'
import { parseTemplate, splitNode } from './parser'
import type {
  ParserConfig,
  PropSelectorResult,
  TaskDeclInfo,
  TaskInfo,
  TaskParts,
  TaskRefInfo
} from './types'

function parseNext(node: Node, refs: TaskRefInfo[]) {
  eachOrOne(node, n => {
    if (isString(n)) {
      const [target, attrs] = parseAttr(n.value, ['JumpBack', 'Anchor'] as const)
      refs.push({
        type: 'task.next',
        target: target as TaskName,
        objMode: false,
        attrs,
        location: n
      })
    } else if (n.type === 'object') {
      let loc: StringNode | null = null
      let jb: boolean | undefined
      let an: boolean | undefined
      let target = '' as TaskName
      for (const [key, obj] of parseObj(n)) {
        if (key === 'name' && isString(obj)) {
          target = obj.value as TaskName
          loc = obj
        } else if (key === 'jump_back' && isBool(obj)) {
          jb = obj.value
        } else if (key === 'anchor' && isBool(obj)) {
          an = obj.value
        }
      }
      if (loc) {
        refs.push({
          type: 'task.next',
          target,
          objMode: true,
          attrs: { offset: 0, attrs: { JumpBack: jb, Anchor: an }, unknown: [] },
          location: loc!
        })
      }
    }
  })
}

function parseAnchor(node: Node, decls: TaskDeclInfo[], refs: TaskRefInfo[], task: TaskName) {
  const parseOne = (n: Node) => {
    if (isString(n)) {
      decls.push({
        type: 'task.anchor',
        anchor: n.value as AnchorName,
        task,
        belong: task,
        location: n
      })
    }
  }
  if (isString(node) || node.type === 'array') {
    eachOrOne(node, parseOne)
  } else {
    for (const [key, obj, prop] of parseObjectFlex(node)) {
      if (obj && isString(obj)) {
        decls.push({
          type: 'task.anchor',
          anchor: key as AnchorName,
          task: obj.value as TaskName,
          belong: task,
          location: prop
        })
        refs.push({ type: 'task.anchor', target: obj.value as TaskName, location: obj })
      } else {
        decls.push({
          type: 'task.anchor',
          anchor: key as AnchorName,
          task: '' as TaskName,
          belong: task,
          location: prop
        })
      }
    }
  }
}

function parseRoi(node: Node, refs: TaskRefInfo[], task: TaskName, prev: StringNode[]) {
  if (!isString(node)) {
    return
  }
  const [target, attrs] = parseAttr(node.value, ['Anchor'])
  if (attrs.offset > 0) {
    refs.push({
      type: 'task.roi',
      target: target as TaskName,
      attrs,
      prev: [...prev],
      task,
      prevRef: false,
      location: node
    })
  } else {
    const prevRef = !!prev.find(p => p.value === node.value)
    refs.push({
      type: 'task.roi',
      target: node.value as TaskName,
      attrs: { offset: 0, attrs: {}, unknown: [] },
      prev: [...prev],
      task,
      prevRef,
      location: node
    })
  }
}

function parseTarget(node: Node, refs: TaskRefInfo[], acceptArray = false) {
  const parseOne = (n: Node) => {
    if (isString(n)) {
      const [target, attrs] = parseAttr(n.value, ['Anchor'])
      refs.push({ type: 'task.target', target: target as TaskName, attrs, location: n })
    }
  }
  if (acceptArray && node.type === 'array') {
    for (const obj of parseArray(node)) {
      parseOne(obj)
    }
  } else {
    parseOne(node)
  }
}

function parseColorFilter(node: Node, refs: TaskRefInfo[]) {
  if (isString(node)) {
    refs.push({ type: 'task.color_filter', target: node.value as TaskName, location: node })
  }
}

function parseFocus(node: Node, refs: TaskRefInfo[]) {
  for (const [_key, obj] of parseObj(node)) {
    if (!isString(obj)) {
      continue
    }
    if (obj.value.startsWith('$')) {
      refs.push({ type: 'task.locale', target: obj.value.substring(1), location: obj })
    } else if (obj.value.length > 0) {
      refs.push({ type: 'task.can_locale', target: obj.value, location: obj })
    }
  }
}

function parseFreeze(node: Node, refs: TaskRefInfo[]) {
  if (typeof node !== 'object' || node.type !== 'object') {
    return
  }
  for (const [key, obj] of parseObj(node)) {
    if (key === 'target') {
      parseTarget(obj, refs)
    }
  }
}

function parseColor(node: Node, refs: TaskRefInfo[], method: 'rgb' | 'hsv') {
  const isColorArr = (n: Node) => {
    let count = 0
    for (const item of parseArray(n)) {
      if (!isNumber(item)) {
        return false
      }
      count++
    }
    return count === 3
  }
  const addColor = (n: Node) => {
    const color: number[] = []
    for (const obj of parseArray(n)) {
      if (isNumber(obj)) {
        color.push(obj.value)
      }
    }
    refs.push({ type: 'task.color', method, color, location: n })
  }
  if (isColorArr(node)) {
    addColor(node)
  } else {
    for (const item of parseArray(node)) {
      if (isColorArr(item)) {
        addColor(item)
      }
    }
  }
}

function parseSubName(
  node: Node,
  decls: TaskDeclInfo[],
  task: TaskName,
  parent: Node
): StringNode | null {
  if (isString(node)) {
    decls.push({ type: 'task.sub_reco', name: node.value, reco: parent, task, location: node })
    return node
  }
  return null
}

function processCustom(
  result: PropSelectorResult,
  customName: string,
  customType: 'reco' | 'act',
  refs: TaskRefInfo[]
) {
  const meta = { customName, customType, missingPolicy: result.missingPolicy ?? 'error' } as const
  switch (result.type) {
    case 'taskRef':
      refs.push({
        type: 'task.custom_task',
        target: result.node.value as TaskName,
        meta,
        location: result.node
      })
      break
    case 'anchorRef':
      refs.push({
        type: 'task.custom_anchor',
        target: result.node.value,
        meta,
        attrs: { offset: 0, attrs: { Anchor: true }, unknown: [] },
        location: result.node
      })
      break
    case 'template':
      refs.push({
        type: 'task.custom_template',
        target: result.node.value as ImageRelativePath,
        meta,
        location: result.node
      })
      break
  }
}

function parseRecoAndAct(
  parts: TaskParts,
  decls: TaskDeclInfo[],
  refs: TaskRefInfo[],
  task: TaskName,
  parentPrev: StringNode[],
  parser?: ParserConfig
) {
  const prev = parentPrev
  let colorMethod: 'rgb' | 'hsv' | null = null
  let customReco: string | null = null

  for (const [key, obj] of parts.base) {
    if (key === 'sub_name') {
      const sn = parseSubName(obj, decls, task, parts.node)
      if (sn) {
        prev.push(sn)
      }
    }
  }

  for (const [key, obj] of parts.reco) {
    switch (key) {
      case 'roi':
        parseRoi(obj, refs, task, prev)
        break
      case 'template':
        parseTemplate(obj, refs)
        break
      case 'color_filter':
        parseColorFilter(obj, refs)
        break
      case 'all_of':
      case 'any_of':
        for (const sub of parseArray(obj)) {
          if (isString(sub)) {
            refs.push({ type: 'task.reco', target: sub.value as TaskName, location: sub })
          } else {
            const subParts = splitNode(sub, false)
            parseRecoAndAct(subParts, decls, refs, task, prev)
          }
        }
        break
      case 'method':
        if (isNumber(obj)) {
          colorMethod = obj.value === 4 ? 'rgb' : obj.value === 40 ? 'hsv' : null
        }
        break
      case 'custom_recognition':
        if (isString(obj)) {
          customReco = obj.value
        }
        break
    }
  }

  if (colorMethod) {
    for (const [key, obj] of parts.reco) {
      if (key === 'upper' || key === 'lower') {
        parseColor(obj, refs, colorMethod)
      }
    }
  }

  if (customReco && parser?.customReco) {
    for (const [key, obj] of parts.reco) {
      if (key === 'custom_recognition_param') {
        const results = parser.customReco(customReco, obj, {
          parseObject: parseObj,
          parseObjectFlex,
          parseArray,
          isString,
          isNumber,
          isBool
        })
        for (const r of results) {
          processCustom(r, customReco, 'reco', refs)
        }
      }
    }
  }

  let customAct: string | null = null
  for (const [key, obj] of parts.act) {
    switch (key) {
      case 'target':
      case 'begin':
        parseTarget(obj, refs)
        break
      case 'end':
        parseTarget(obj, refs, true)
        break
      case 'custom_action':
        if (isString(obj)) {
          customAct = obj.value
        }
        break
    }
  }

  if (customAct && parser?.customAction) {
    for (const [key, obj] of parts.act) {
      if (key === 'custom_action_param') {
        const results = parser.customAction(customAct, obj, {
          parseObject: parseObj,
          parseObjectFlex,
          parseArray,
          isString,
          isNumber,
          isBool
        })
        for (const r of results) {
          processCustom(r, customAct, 'act', refs)
        }
      }
    }
  }
}

export function parseTaskNode(
  node: Node,
  opts: { taskName: TaskName; taskKey: StringNode; parser?: ParserConfig }
): TaskInfo {
  const { taskName, parser } = opts
  const parts = splitNode(node, false)

  const decls: TaskDeclInfo[] = [
    { type: 'task.decl', task: taskName, tasks: [], location: opts.taskKey }
  ]
  const refs: TaskRefInfo[] = []

  for (const [key, obj] of parts.base) {
    switch (key) {
      case 'next':
      case 'on_error':
        parseNext(obj, refs)
        break
      case 'anchor':
        parseAnchor(obj, decls, refs, taskName)
        break
      case 'pre_wait_freezes':
      case 'post_wait_freezes':
      case 'repeat_wait_freezes':
        parseFreeze(obj, refs)
        break
      case 'focus':
        parseFocus(obj, refs)
        break
      case 'doc':
      case 'desc':
        if (isString(obj)) {
          decls.push({ type: 'task.doc', task: taskName, doc: obj.value, location: obj })
        }
        break
    }
  }

  parseRecoAndAct(parts, decls, refs, taskName, [], parser)

  for (const [key, _obj, propNode] of parts.unknown) {
    if (key.startsWith('$__mpe')) {
      decls.push({ type: 'task.mpe_config', location: propNode })
    }
  }

  return { parts, decls, refs, prop: opts.taskKey, data: node }
}

export function parsePipelineFile(
  content: string,
  opts: { maa: boolean; isDefault?: boolean; parser?: ParserConfig }
) {
  const tree = parseTreeWithoutParent(content)
  const tasks = new Map<TaskName, TaskInfo>()
  const fileDecls: TaskDeclInfo[] = []
  if (!tree || tree.type !== 'object') {
    return { tasks, fileDecls }
  }

  for (const [key, obj, propNode] of parseObj(tree)) {
    if (key.startsWith('$')) {
      if (key.startsWith('$__mpe')) {
        fileDecls.push({ type: 'task.mpe_config', location: propNode })
      }
      continue
    }
    const taskName = (opts.isDefault ? '$' + key : key) as TaskName

    if (opts.maa) {
      tasks.set(taskName, parseMaaTaskNode(obj, taskName, propNode))
    } else {
      tasks.set(taskName, parseTaskNode(obj, { taskName, taskKey: propNode, parser: opts.parser }))
    }
  }
  return { tasks, fileDecls }
}
