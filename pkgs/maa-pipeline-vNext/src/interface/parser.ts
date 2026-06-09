import type { Node } from 'jsonc-parser'

import { buildTree, parseTreeWithoutParent } from '../utils/json'
import { eachOrOne, isString, parseArray, parseObject, parseObjectFlex } from '../utils/parse'
import type {
  InterfaceDeclVariant,
  InterfaceRefVariant,
  ParsedInterface,
  RawInterfaceParseResult
} from './types'

export function parseInterface(content: string): RawInterfaceParseResult | null {
  const node = parseTreeWithoutParent(content)
  if (!node || node.type !== 'object') {
    return null
  }

  const decls: InterfaceDeclVariant[] = []
  const refs: InterfaceRefVariant[] = []
  const raw: Record<string, unknown> = {}

  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'controller':
        parseControllers(obj, decls, refs, raw)
        break
      case 'resource':
        parseResources(obj, decls, refs, raw)
        break
      case 'task':
        parseTasks(obj, decls, refs, raw)
        break
      case 'option':
        parseOptions(obj, decls, refs, raw)
        break
      case 'global_option':
        parseGlobalOption(obj, refs, raw)
        break
      case 'preset':
        parsePresets(obj, decls, refs, raw)
        break
      case 'group':
        parseGroups(obj, decls, raw)
        break
      case 'import':
        parseImports(obj, refs, raw)
        break
      case 'languages':
        parseLanguages(obj, decls, refs, raw)
        break
      default:
        raw[key] = buildTree(obj)
    }
  }

  const data = buildRawToParsed(raw)
  return { data, decls, refs }
}

// ── Controllers ──

function parseControllers(
  node: Node,
  decls: InterfaceDeclVariant[],
  refs: InterfaceRefVariant[],
  raw: Record<string, unknown>
) {
  const arr: unknown[] = []
  raw.controller = arr
  for (const obj of parseArray(node)) {
    const ctrlRaw: Record<string, unknown> = {}
    arr.push(ctrlRaw)
    let nameLoc: Node | null = null
    let ctrlName = ''
    for (const [key, val] of parseObject(obj)) {
      switch (key) {
        case 'name':
          if (isString(val)) {
            nameLoc = val
            ctrlName = val.value
          }
          ctrlRaw[key] = buildTree(val)
          break
        case 'attach_resource_path':
          parseResourcePaths(val, refs)
          ctrlRaw[key] = buildTree(val)
          break
        case 'option':
          for (const sub of parseArray(val)) {
            if (isString(sub)) {
              refs.push({
                type: 'interface.option',
                target: sub.value,
                trace: { from: 'controller', origin: ctrlName },
                location: sub
              })
            }
          }
          ctrlRaw[key] = buildTree(val)
          break
        default:
          ctrlRaw[key] = buildTree(val)
      }
    }
    if (nameLoc) {
      decls.push({ type: 'interface.controller', name: ctrlName, location: nameLoc })
    }
  }
}

// ── Resources ──

function parseResources(
  node: Node,
  decls: InterfaceDeclVariant[],
  refs: InterfaceRefVariant[],
  raw: Record<string, unknown>
) {
  const arr: unknown[] = []
  raw.resource = arr
  for (const obj of parseArray(node)) {
    const resRaw: Record<string, unknown> = {}
    arr.push(resRaw)
    let nameLoc: Node | null = null
    let resName = ''
    for (const [key, val] of parseObject(obj)) {
      switch (key) {
        case 'name':
          if (isString(val)) {
            nameLoc = val
            resName = val.value
          }
          resRaw[key] = buildTree(val)
          break
        case 'path':
          parseResourcePaths(val, refs)
          resRaw[key] = buildTree(val)
          break
        case 'controller':
          for (const sub of parseArray(val)) {
            if (isString(sub)) {
              refs.push({ type: 'interface.controller', target: sub.value, location: sub })
            }
          }
          resRaw[key] = buildTree(val)
          break
        case 'option':
          for (const sub of parseArray(val)) {
            if (isString(sub)) {
              refs.push({
                type: 'interface.option',
                target: sub.value,
                trace: { from: 'resource', origin: resName },
                location: sub
              })
            }
          }
          resRaw[key] = buildTree(val)
          break
        default:
          resRaw[key] = buildTree(val)
      }
    }
    if (nameLoc) {
      decls.push({ type: 'interface.resource', name: resName, location: nameLoc })
    }
  }
}

function parseResourcePaths(node: Node, refs: InterfaceRefVariant[]) {
  eachOrOne(node, n => {
    if (isString(n)) {
      refs.push({ type: 'interface.resource_path', target: n.value as never, location: n })
    }
  })
}

// ── Tasks ──

function parseTasks(
  node: Node,
  decls: InterfaceDeclVariant[],
  refs: InterfaceRefVariant[],
  raw: Record<string, unknown>
) {
  const arr: unknown[] = []
  raw.task = arr
  for (const obj of parseArray(node)) {
    const taskRaw: Record<string, unknown> = {}
    arr.push(taskRaw)
    let nameLoc: Node | null = null
    let taskName = ''
    for (const [key, val] of parseObject(obj)) {
      switch (key) {
        case 'name':
          if (isString(val)) {
            nameLoc = val
            taskName = val.value
            taskRaw[key] = val.value
          } else {
            taskRaw[key] = buildTree(val)
          }
          break
        case 'entry':
          if (isString(val)) {
            refs.push({
              type: 'interface.task_entry',
              target: val.value,
              task: taskName,
              location: val
            })
          }
          taskRaw[key] = buildTree(val)
          break
        case 'resource':
          for (const sub of parseArray(val)) {
            if (isString(sub)) {
              refs.push({ type: 'interface.resource', target: sub.value, location: sub })
            }
          }
          taskRaw[key] = buildTree(val)
          break
        case 'controller':
          for (const sub of parseArray(val)) {
            if (isString(sub)) {
              refs.push({ type: 'interface.controller', target: sub.value, location: sub })
            }
          }
          taskRaw[key] = buildTree(val)
          break
        case 'option':
          for (const sub of parseArray(val)) {
            if (isString(sub)) {
              refs.push({
                type: 'interface.option',
                target: sub.value,
                trace: { from: 'task', origin: taskName },
                location: sub
              })
            }
          }
          taskRaw[key] = buildTree(val)
          break
        case 'group':
          for (const sub of parseArray(val)) {
            if (isString(sub)) {
              refs.push({ type: 'interface.group', target: sub.value, location: sub })
            }
          }
          taskRaw[key] = buildTree(val)
          break
        case 'pipeline_override':
          taskRaw[key] = buildTree(val)
          break
        default:
          taskRaw[key] = buildTree(val)
      }
    }
    if (nameLoc) {
      decls.push({ type: 'interface.task', name: taskName, location: nameLoc })
    }
  }
}

// ── Options ──

function parseOptions(
  node: Node,
  decls: InterfaceDeclVariant[],
  refs: InterfaceRefVariant[],
  raw: Record<string, unknown>
) {
  const optObj: Record<string, unknown> = {}
  raw.option = optObj
  for (const [optName, optVal, propNode] of parseObjectFlex(node)) {
    if (!optVal) {
      optObj[optName] = null
      continue
    }
    const optRaw: Record<string, unknown> = {}
    optObj[optName] = optRaw
    let optType: string | undefined
    let inputNames: string[] = []

    for (const [key, val] of parseObject(optVal)) {
      switch (key) {
        case 'type':
          if (isString(val)) {
            optType = val.value
          }
          optRaw[key] = buildTree(val)
          break
        case 'cases':
          parseCases(val, decls, refs, optName, optRaw)
          break
        case 'inputs':
          inputNames = parseInputs(val, decls, optName, optRaw)
          break
        case 'pipeline_override':
          parseInputRefsInOverride(val, refs, optName, inputNames)
          optRaw[key] = buildTree(val)
          break
        case 'default_case':
          parseDefaultCase(val, refs, optName)
          optRaw[key] = buildTree(val)
          break
        case 'controller':
          for (const sub of parseArray(val)) {
            if (isString(sub))
              refs.push({ type: 'interface.controller', target: sub.value, location: sub })
          }
          optRaw[key] = buildTree(val)
          break
        case 'resource':
          for (const sub of parseArray(val)) {
            if (isString(sub))
              refs.push({ type: 'interface.resource', target: sub.value, location: sub })
          }
          optRaw[key] = buildTree(val)
          break
        default:
          optRaw[key] = buildTree(val)
      }
    }
    decls.push({ type: 'interface.option', name: optName, optionType: optType, location: propNode })
  }
}

function parseCases(
  node: Node,
  decls: InterfaceDeclVariant[],
  refs: InterfaceRefVariant[],
  option: string,
  parentRaw: Record<string, unknown>
) {
  const casesRaw: Record<string, unknown> = {}
  parentRaw.cases = casesRaw
  for (const obj of parseArray(node)) {
    let caseName = ''
    let caseNameLoc: Node | null = null
    const caseRaw: Record<string, unknown> = {}
    for (const [key, val] of parseObject(obj)) {
      switch (key) {
        case 'name':
          if (isString(val)) {
            caseName = val.value
            caseNameLoc = val
          }
          caseRaw[key] = buildTree(val)
          break
        case 'option':
          for (const sub of parseArray(val)) {
            if (isString(sub)) {
              refs.push({
                type: 'interface.option',
                target: sub.value,
                trace: { from: 'option', origin: option },
                location: sub
              })
            }
          }
          caseRaw[key] = buildTree(val)
          break
        case 'pipeline_override':
          caseRaw[key] = buildTree(val)
          break
        default:
          caseRaw[key] = buildTree(val)
      }
    }
    if (caseNameLoc && caseName) {
      casesRaw[caseName] = caseRaw
      decls.push({ type: 'interface.case', name: caseName, option, location: caseNameLoc })
    }
  }
}

function parseInputs(
  node: Node,
  decls: InterfaceDeclVariant[],
  option: string,
  parentRaw: Record<string, unknown>
): string[] {
  const inputsRaw: Record<string, unknown> = {}
  parentRaw.inputs = inputsRaw
  const names: string[] = []
  for (const obj of parseArray(node)) {
    let inputName = ''
    let inputLoc: Node | null = null
    let cast: 'string' | 'int' | 'bool' | undefined
    const inputRaw: Record<string, unknown> = {}
    for (const [key, val] of parseObject(obj)) {
      switch (key) {
        case 'name':
          if (isString(val)) {
            inputName = val.value
            inputLoc = val
          }
          inputRaw[key] = buildTree(val)
          break
        case 'pipeline_type':
          if (isString(val) && ['string', 'int', 'bool'].includes(val.value)) {
            cast = val.value as 'string' | 'int' | 'bool'
          }
          inputRaw[key] = buildTree(val)
          break
        default:
          inputRaw[key] = buildTree(val)
      }
    }
    if (inputLoc && inputName) {
      inputsRaw[inputName] = inputRaw
      names.push(inputName)
      decls.push({ type: 'interface.input', name: inputName, option, cast, location: inputLoc })
    }
  }
  return names
}

function parseDefaultCase(node: Node, refs: InterfaceRefVariant[], option: string) {
  eachOrOne(node, n => {
    if (isString(n)) {
      refs.push({ type: 'interface.case', target: n.value, option, location: n })
    }
  })
}

function parseInputRefsInOverride(
  node: Node,
  refs: InterfaceRefVariant[],
  option: string,
  inputNames: string[]
) {
  if (inputNames.length === 0) {
    return
  }
  const searchNames: [string, RegExp][] = inputNames.map(n => [
    n,
    new RegExp('\\{' + n + '\\}', 'g')
  ])
  searchInputRefs(node, refs, option, searchNames)
}

function searchInputRefs(
  node: Node,
  refs: InterfaceRefVariant[],
  option: string,
  names: [string, RegExp][]
) {
  if (isString(node)) {
    for (const [name, re] of names) {
      for (const m of node.value.matchAll(re)) {
        refs.push({
          type: 'interface.input',
          target: name,
          option,
          location: node,
          offset: m.index
        })
      }
    }
  } else if (node.type === 'array') {
    for (const sub of parseArray(node)) {
      searchInputRefs(sub, refs, option, names)
    }
  } else if (node.type === 'object') {
    for (const [, val] of parseObject(node)) {
      searchInputRefs(val, refs, option, names)
    }
  }
}

// ── Presets ──

function parsePresets(
  node: Node,
  decls: InterfaceDeclVariant[],
  refs: InterfaceRefVariant[],
  raw: Record<string, unknown>
) {
  const arr: unknown[] = []
  raw.preset = arr
  for (const obj of parseArray(node)) {
    const presetRaw: Record<string, unknown> = {}
    arr.push(presetRaw)
    let nameLoc: Node | null = null
    let presetName = ''
    for (const [key, val] of parseObject(obj)) {
      switch (key) {
        case 'name':
          if (isString(val)) {
            nameLoc = val
            presetName = val.value
          }
          presetRaw[key] = buildTree(val)
          break
        case 'task':
          parsePresetTasks(val, refs, presetName, presetRaw)
          break
        default:
          presetRaw[key] = buildTree(val)
      }
    }
    if (nameLoc) {
      decls.push({ type: 'interface.preset', name: presetName, location: nameLoc })
    }
  }
}

function parsePresetTasks(
  node: Node,
  refs: InterfaceRefVariant[],
  presetName: string,
  parentRaw: Record<string, unknown>
) {
  const tasksRaw: Record<string, unknown> = {}
  parentRaw.task = tasksRaw
  for (const obj of parseArray(node)) {
    let taskName = ''
    const taskRaw: Record<string, unknown> = {}
    for (const [key, val] of parseObject(obj)) {
      switch (key) {
        case 'name':
          if (isString(val)) {
            taskName = val.value
            taskRaw[key] = val.value
            refs.push({ type: 'interface.task', target: taskName, location: val })
          } else {
            taskRaw[key] = buildTree(val)
          }
          break
        case 'option':
          parsePresetOptions(val, refs, presetName, taskRaw)
          break
        default:
          taskRaw[key] = buildTree(val)
      }
    }
    if (taskName) {
      tasksRaw[taskName] = taskRaw
    }
  }
}

function parsePresetOptions(
  node: Node,
  refs: InterfaceRefVariant[],
  presetName: string,
  parentRaw: Record<string, unknown>
) {
  const optRaw: Record<string, unknown> = {}
  parentRaw.option = optRaw
  for (const [optName, optVal, propNode] of parseObjectFlex(node)) {
    refs.push({
      type: 'interface.option',
      target: optName,
      trace: { from: 'preset', origin: presetName },
      location: propNode,
      presetValue: optVal ? buildTree(optVal) : undefined
    })
    if (!optVal) {
      optRaw[optName] = null
      continue
    }
    if (isString(optVal)) {
      refs.push({ type: 'interface.case', target: optVal.value, option: optName, location: optVal })
      optRaw[optName] = buildTree(optVal)
    } else if (optVal.type === 'array') {
      const arr: unknown[] = []
      optRaw[optName] = arr
      for (const sub of parseArray(optVal)) {
        if (isString(sub)) {
          refs.push({ type: 'interface.case', target: sub.value, option: optName, location: sub })
        }
        arr.push(buildTree(sub))
      }
    } else {
      const obj: Record<string, unknown> = {}
      optRaw[optName] = obj
      for (const [inpName, _, inpProp] of parseObjectFlex(optVal)) {
        refs.push({ type: 'interface.input', target: inpName, option: optName, location: inpProp })
        if (_) {
          obj[inpName] = buildTree(_)
        }
      }
    }
  }
}

// ── Simple sections ──

function parseGlobalOption(node: Node, refs: InterfaceRefVariant[], raw: Record<string, unknown>) {
  const arr: string[] = []
  raw.global_option = arr
  for (const obj of parseArray(node)) {
    if (isString(obj)) {
      arr.push(obj.value)
      refs.push({
        type: 'interface.option',
        target: obj.value,
        trace: { from: 'global', origin: '' },
        location: obj
      })
    }
  }
}

function parseGroups(node: Node, decls: InterfaceDeclVariant[], raw: Record<string, unknown>) {
  const arr: unknown[] = []
  raw.group = arr
  for (const obj of parseArray(node)) {
    const groupRaw: Record<string, unknown> = {}
    arr.push(groupRaw)
    for (const [key, val] of parseObject(obj)) {
      if (key === 'name' && isString(val)) {
        decls.push({ type: 'interface.group', name: val.value, location: val })
      }
      groupRaw[key] = buildTree(val)
    }
  }
}

function parseImports(node: Node, refs: InterfaceRefVariant[], raw: Record<string, unknown>) {
  const arr: string[] = []
  raw.import = arr
  for (const obj of parseArray(node)) {
    if (isString(obj)) {
      arr.push(obj.value)
      refs.push({ type: 'interface.import_path', target: obj.value as never, location: obj })
    }
  }
}

function parseLanguages(
  node: Node,
  decls: InterfaceDeclVariant[],
  refs: InterfaceRefVariant[],
  raw: Record<string, unknown>
) {
  const langs: Record<string, string> = {}
  raw.languages = langs
  for (const [key, val] of parseObject(node)) {
    if (isString(val)) {
      langs[key] = val.value
      decls.push({ type: 'interface.language', name: key, path: val.value, location: val })
      refs.push({ type: 'interface.language_path', target: val.value, location: val })
    }
  }
}

// ── Data conversion: arrays → Records ──

function arrayToRecord(arr: unknown[]): Record<string, unknown> {
  const rec: Record<string, unknown> = {}
  for (const item of arr) {
    const obj = item as Record<string, unknown>
    if (typeof obj.name !== 'string') {
      continue
    }
    const { name: _, ...rest } = obj
    rec[obj.name] = rest
  }
  return rec
}

function buildRawToParsed(raw: Record<string, unknown>): ParsedInterface {
  raw.controller = Array.isArray(raw.controller) ? arrayToRecord(raw.controller) : {}
  raw.resource = Array.isArray(raw.resource) ? arrayToRecord(raw.resource) : {}
  raw.task = Array.isArray(raw.task) ? arrayToRecord(raw.task) : {}
  raw.option = raw.option ?? {}
  raw.preset = Array.isArray(raw.preset) ? arrayToRecord(raw.preset) : {}
  raw.group = Array.isArray(raw.group) ? arrayToRecord(raw.group) : {}
  return raw as ParsedInterface
}
