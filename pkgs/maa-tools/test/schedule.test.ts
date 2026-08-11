import assert from 'node:assert/strict'
import test from 'node:test'

import {
  compareTestCases,
  getDefaultTestJobCount,
  groupResourcePlans
} from '../src/test/schedule.ts'
import type { TestCases } from '../src/types/config'

function testCases(controller: string, resource: string): TestCases {
  return {
    configs: { controller, resource },
    cases: []
  }
}

test('default test job count is an integer and at least one', () => {
  assert.equal(getDefaultTestJobCount(0), 1)
  assert.equal(getDefaultTestJobCount(1), 1)
  assert.equal(getDefaultTestJobCount(3), 1)
  assert.equal(getDefaultTestJobCount(8), 2)
  assert.equal(getDefaultTestJobCount(22), 5)
})

test('test cases use a stable controller then resource order', () => {
  const cases = [testCases('b', 'a'), testCases('a', 'b'), testCases('a', 'a')]

  cases.sort(compareTestCases)

  assert.deepEqual(
    cases.map(item => [item.configs.controller, item.configs.resource]),
    [
      ['a', 'a'],
      ['a', 'b'],
      ['b', 'a']
    ]
  )
})

test('resource plans reuse a group without changing plan order', () => {
  const plans = [
    { id: 'first', resourcePaths: ['base', 'shared'] },
    { id: 'second', resourcePaths: ['other'] },
    { id: 'third', resourcePaths: ['base', 'shared'] }
  ]

  const groups = groupResourcePlans(plans)

  assert.deepEqual(
    groups.map(group => group.map(plan => plan.id)),
    [['first', 'third'], ['second']]
  )
})

test('resource path order remains part of the pool identity', () => {
  const groups = groupResourcePlans([
    { id: 'forward', resourcePaths: ['base', 'override'] },
    { id: 'reverse', resourcePaths: ['override', 'base'] }
  ])

  assert.deepEqual(
    groups.map(group => group.map(plan => plan.id)),
    [['forward'], ['reverse']]
  )
})

test('resource path arrays cannot collide through delimiter placement', () => {
  const groups = groupResourcePlans([
    { id: 'left', resourcePaths: ['a-b', 'c'] },
    { id: 'right', resourcePaths: ['a', 'b-c'] }
  ])

  assert.equal(groups.length, 2)
})
