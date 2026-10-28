import assert from 'node:assert/strict'
import * as path from 'node:path'
import test from 'node:test'

import { type RunTarget, TestSourceError, filterGroupsForFiles } from '../src/test/filter.ts'
import type { TestCases } from '../src/types/config.ts'

const fileA = path.resolve('source-tests/a.json')
const fileB = path.resolve('source-tests/b.json')

function caseOf(
  file: string,
  index: number,
  image = 'same.png',
  hits = ['A']
): TestCases['cases'][number] {
  return { image, hits, origin: { file, case: index } }
}

function group(cases: TestCases['cases'], name = '同名组'): TestCases {
  return { configs: { controller: 'Controller', resource: 'Resource', name }, cases }
}

function target(file: string, selected?: number[]): RunTarget {
  return { file, controllers: ['Controller'], resources: ['Resource'], cases: [], selected }
}

test('同名组、同图片和相同期望也按原始文件精确选择', () => {
  const first = group([caseOf(fileA, 0), caseOf(fileA, 1)])
  const second = group([caseOf(fileB, 0)])
  const { groups } = filterGroupsForFiles([first, second], [target(fileA)])
  assert.equal(groups.length, 1)
  assert.deepEqual(
    groups[0].cases.map(testCase => testCase.origin),
    [
      { file: fileA, case: 0 },
      { file: fileA, case: 1 }
    ]
  )
  assert.equal(second.cases[0].origin?.file, fileB)
})

test('同图同节点但期望框不同，按下标只选第二条，不靠内容猜测', () => {
  const first = { ...caseOf(fileA, 0), hits: [{ node: 'A', box: [0, 0, 10, 10] as maa.Rect }] }
  const second = { ...caseOf(fileA, 1), hits: [{ node: 'A', box: [20, 20, 10, 10] as maa.Rect }] }
  const original = group([first, second])
  const { groups } = filterGroupsForFiles([original], [target(fileA, [1])])
  assert.deepEqual(groups[0].cases, [second])
  assert.equal(original.cases.length, 2)
})

test('内容完全相同的用例仍保留各自下标，多个选中下标取并集', () => {
  const original = group([caseOf(fileA, 0), caseOf(fileA, 1), caseOf(fileA, 2)])
  const { groups } = filterGroupsForFiles([original], [target(fileA, [0]), target(fileA, [2])])
  assert.deepEqual(
    groups[0].cases.map(testCase => testCase.origin?.case),
    [0, 2]
  )
})

test('纯负例单跑仍保留整组节点，不改变负例断言；过滤不修改原组', () => {
  const original = group([
    caseOf(fileA, 0, 'negative.png', []),
    caseOf(fileA, 1, 'a.png', ['A']),
    caseOf(fileA, 2, 'b.png', ['B'])
  ])
  const { groups } = filterGroupsForFiles([original], [target(fileA, [0])])
  assert.equal(groups[0].cases.length, 1)
  assert.deepEqual(groups[0].nodes, ['A', 'B'])
  assert.equal(original.nodes, undefined)
  assert.equal(original.cases.length, 3)
})

test('loader已固定的nodes过滤后照样保留，组名可以任意改变', () => {
  const original = { ...group([caseOf(fileA, 4)], '任意名字'), nodes: ['A', 'B', 'C'] }
  const { groups } = filterGroupsForFiles([original], [target(fileA, [4])])
  assert.deepEqual(groups[0].nodes, ['A', 'B', 'C'])
  assert.equal(groups[0].cases[0].origin?.case, 4)
})

test('没有原始origin时按文件选择明确报来源错误，不拿source或内容猜下标', () => {
  const original = { ...group([{ image: 'same.png', hits: ['A'] }]), source: fileA }
  assert.throws(
    () => filterGroupsForFiles([original], [target(fileA, [0])]),
    (error: unknown) =>
      error instanceof TestSourceError && error.errorCode === 'test-source-missing'
  )
})

test('混合来源组只留下所选文件的用例，未匹配的目标不借用别人的结果', () => {
  const original = group([caseOf(fileA, 0), caseOf(fileB, 1)])
  const { groups } = filterGroupsForFiles([original], [target(fileA, [1])])
  assert.deepEqual(groups, [])
})
