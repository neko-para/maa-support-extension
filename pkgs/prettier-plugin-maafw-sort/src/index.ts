import type { Plugin } from 'prettier'

import { options } from './option'
import { createParser, parsers } from './parser'

export { options, parsers }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const plugin: Plugin = {
  options,
  parsers
}

export function patchPlugin(plugin: Plugin) {
  const newPlugin = {
    ...plugin
  }

  if (newPlugin.parsers?.json) {
    const old = newPlugin.parsers.json
    newPlugin.parsers.json = {
      ...old,
      parse: createParser('json', old.parse.bind(old))
    }
  } else {
    newPlugin.parsers = newPlugin.parsers ?? {}
    newPlugin.parsers.json = parsers.json
  }

  if (newPlugin.parsers?.jsonc) {
    const old = newPlugin.parsers.jsonc
    newPlugin.parsers.jsonc = {
      ...old,
      parse: createParser('jsonc', old.parse.bind(old))
    }
  } else {
    newPlugin.parsers = newPlugin.parsers ?? {}
    newPlugin.parsers.jsonc = parsers.jsonc
  }

  newPlugin.options = newPlugin.options ?? {}
  newPlugin.options = {
    ...(newPlugin.options ?? {}),
    ...options
  }

  return newPlugin
}
