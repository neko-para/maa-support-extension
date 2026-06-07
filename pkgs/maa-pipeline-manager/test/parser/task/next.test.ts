import { describe, expect, test } from 'vitest'
import type { TaskNextRefInfo } from '../../../src/parser/task/types'
import { findRef, parseTaskFromJson } from './helper'

describe('parseTask — next', () => {
  test('string array', () => {
    const { info } = parseTaskFromJson('{ "T": { "next": ["A", "B"] } }')

    const refs = findRef(info.refs, 'task.next') as TaskNextRefInfo[]
    expect(refs).toHaveLength(2)
    expect(refs[0]).toMatchObject({ type: 'task.next', target: 'A', objMode: false })
    expect(refs[1]).toMatchObject({ type: 'task.next', target: 'B', objMode: false })
  })

  test('with [Anchor] prefix', () => {
    const { info } = parseTaskFromJson('{ "T": { "next": "[Anchor]A" } }')

    const ref = findRef(info.refs, 'task.next')[0] as TaskNextRefInfo | undefined
    expect(ref).toBeDefined()
    expect(ref!.attrs.attrs.Anchor).toBe(true)
    expect(ref!.target).toBe('A')
  })

  test('with [JumpBack] prefix', () => {
    const { info } = parseTaskFromJson('{ "T": { "next": "[JumpBack]" } }')

    const ref = findRef(info.refs, 'task.next')[0] as TaskNextRefInfo | undefined
    expect(ref).toBeDefined()
    expect(ref!.attrs.attrs.JumpBack).toBe(true)
  })

  test('obj mode', () => {
    const { info } = parseTaskFromJson('{ "T": { "next": { "name": "A" } } }')

    const ref = findRef(info.refs, 'task.next')[0] as TaskNextRefInfo | undefined
    expect(ref).toBeDefined()
    expect(ref!.objMode).toBe(true)
    expect(ref!.target).toBe('A')
  })
})
