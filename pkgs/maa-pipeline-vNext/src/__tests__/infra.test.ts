import * as nodePath from 'node:path'
import { describe, expect, it } from 'vitest'

import type { IPathUtils } from '../path/interface'
import { nodePathUtils } from '../path/node'
import type { AbsolutePath, RelativePath, TaskName } from '../types'
import { buildTree, parseTreeWithoutParent } from '../utils/json'
import { isString, parseObject } from '../utils/parse'

describe('IPathUtils — NodePathUtils', () => {
  const p: IPathUtils = nodePathUtils

  it('join', () => {
    expect(p.join('/a', 'b', 'c')).toBe(nodePath.join('/a', 'b', 'c'))
  })

  it('relative', () => {
    expect(p.relative('/a/b/c', '/a/b/d')).toBe(nodePath.relative('/a/b/c', '/a/b/d'))
  })

  it('basename', () => {
    expect(p.basename('/a/b/c.json')).toBe('c.json')
  })

  it('dirname', () => {
    expect(p.dirname('/a/b/c.json')).toBe('/a/b')
  })

  it('sep is a string', () => {
    expect(typeof p.sep).toBe('string')
    expect(p.sep.length).toBe(1)
  })
})

describe('branded types (compile-time)', () => {
  it('TaskName accepts branded string', () => {
    const name = 'MyTask' as TaskName
    expect(name).toBe('MyTask')
  })

  it('AbsolutePath accepts branded string', () => {
    const path = '/tmp/test' as AbsolutePath
    expect(path).toBe('/tmp/test')
  })

  it('RelativePath accepts branded string', () => {
    const path = 'pipeline/main.json' as RelativePath
    expect(path).toBe('pipeline/main.json')
  })
})

describe('buildTree', () => {
  it('parses a simple JSON object', () => {
    const json = '{"a": 1, "b": "hello", "c": [1, 2, 3]}'
    const tree = parseTreeWithoutParent(json)
    expect(tree).toBeDefined()
    const obj = buildTree(tree!)
    expect(obj).toEqual({ a: 1, b: 'hello', c: [1, 2, 3] })
  })
})

describe('parseObject', () => {
  it('iterates over object properties', () => {
    const json = '{"name": "task1", "next": ["task2"]}'
    const tree = parseTreeWithoutParent(json)
    const pairs = [...parseObject(tree)]
    expect(pairs).toHaveLength(2)
    expect(pairs[0][0]).toBe('name')
    expect(pairs[1][0]).toBe('next')
    const val = pairs[0][1]
    expect(isString(val)).toBe(true)
    if (isString(val)) {
      expect(val.value).toBe('task1')
    }
  })

  it('skips $ prefixed keys? — no, parseObject returns all keys', () => {
    const json = '{"$key": 1, "normal": 2}'
    const tree = parseTreeWithoutParent(json)
    const pairs = [...parseObject(tree)]
    expect(pairs).toHaveLength(2)
    expect(pairs.map(p => p[0])).toEqual(['$key', 'normal'])
  })

  it('preserves duplicate keys in order', () => {
    const json = '{"a": 1, "a": 2, "b": 3, "a": 4}'
    const tree = parseTreeWithoutParent(json)
    const pairs = [...parseObject(tree)]
    expect(pairs).toHaveLength(4)
    expect(pairs.map(p => p[0])).toEqual(['a', 'a', 'b', 'a'])
    expect(pairs.map(p => p[2].offset)).toEqual([1, 9, 17, 25])
  })

  it('handles empty object', () => {
    const tree = parseTreeWithoutParent('{}')
    const pairs = [...parseObject(tree)]
    expect(pairs).toHaveLength(0)
  })

  it('handles null / non-object', () => {
    expect([...parseObject(null)]).toHaveLength(0)
    expect([...parseObject(undefined)]).toHaveLength(0)
  })
})
