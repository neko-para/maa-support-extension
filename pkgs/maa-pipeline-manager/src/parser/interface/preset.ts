import type { Node } from 'jsonc-parser'

import { isString, parseArray, parseObject, parseObjectFlex } from '../utils'
import type { InterfaceInfo, InterfaceParseContext } from './interface'

function parsePresetOption(
  node: Node,
  info: InterfaceInfo,
  ctx: InterfaceParseContext,
  name: string
) {
  for (const [key, obj, prop] of parseObjectFlex(node)) {
    info.refs.push({
      file: ctx.file,
      location: prop,
      type: 'interface.option',
      target: key,
      trace: {
        name: key,
        from: 'preset',
        origin: name
      },
      preset: obj ?? undefined
    })
    if (!obj) {
      continue
    }
    if (isString(obj)) {
      info.refs.push({
        file: ctx.file,
        location: obj,
        type: 'interface.case',
        option: key,
        target: obj.value
      })
    } else if (obj.type === 'array') {
      for (const val of parseArray(obj)) {
        if (isString(val)) {
          info.refs.push({
            file: ctx.file,
            location: val,
            type: 'interface.case',
            target: val.value,
            option: key
          })
        }
      }
    } else {
      for (const [inputKey, _, inputProp] of parseObjectFlex(obj)) {
        info.refs.push({
          file: ctx.file,
          location: inputProp,
          type: 'interface.input',
          target: inputKey,
          option: key
        })
      }
    }
  }
}

function parsePresetTask(node: Node, info: InterfaceInfo, ctx: InterfaceParseContext) {
  let name = ''
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'name':
        if (isString(obj)) {
          name = obj.value
          info.refs.push({
            file: ctx.file,
            location: obj,
            type: 'interface.task',
            target: obj.value
          })
        }
        break
    }
  }
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'option':
        parsePresetOption(obj, info, ctx, name)
        break
    }
  }
}

function parsePresetSingle(node: Node, info: InterfaceInfo, ctx: InterfaceParseContext) {
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'name':
        if (isString(obj)) {
          info.decls.push({
            file: ctx.file,
            location: obj,
            type: 'interface.preset',
            name: obj.value
          })
        }
        break
      case 'task':
        for (const sub of parseArray(obj)) {
          parsePresetTask(sub, info, ctx)
        }
    }
  }
}

export function parsePreset(node: Node, info: InterfaceInfo, ctx: InterfaceParseContext) {
  for (const obj of parseArray(node)) {
    parsePresetSingle(obj, info, ctx)
  }
}
