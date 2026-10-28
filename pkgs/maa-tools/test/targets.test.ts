import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import test from 'node:test'

import { TestSelectionError, buildRunTargets } from '../src/test/targets.ts'

const content = JSON.stringify({
  configs: { controller: 'C', resource: 'R' },
  cases: [
    { image: 'same.png', hits: ['A'] },
    { image: 'same.png', hits: ['A'] },
    { image: 'b.png', hits: [] }
  ]
})

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maa-pr92-sources-targets-'))
  await fs.writeFile(path.join(root, 'good.json'), content)
  await fs.writeFile(path.join(root, 'bad.json'), '{')
  return root
}

test('重复--case按原下标去重，[]表示未传，目标路径规范化为绝对路径', async t => {
  const root = await fixture()
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const targets = await buildRunTargets(['good.json', './good.json'], [2, 0, 2], root)
  assert.equal(targets.length, 1)
  assert.equal(targets[0].file, path.join(root, 'good.json'))
  assert.deepEqual(targets[0].selected, [2, 0])
  assert.deepEqual(
    targets[0].cases.map(testCase => testCase.index),
    [0, 1, 2]
  )
  assert.equal((await buildRunTargets(['good.json'], [], root))[0].selected, undefined)
})

test('坏文件和不存在的文件各有独立错误，不阻断正常目标', async t => {
  const root = await fixture()
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const targets = await buildRunTargets(['bad.json', 'good.json', 'missing.json'], undefined, root)
  assert.ok(targets[0].error)
  assert.equal(targets[1].error, undefined)
  assert.equal(targets[1].cases.length, 3)
  assert.equal(targets[2].error, '找不到测试文件')
})

test('不合法用例选择抛明确错误代码，不能悄悄运行其它下标', async t => {
  const root = await fixture()
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  for (const indexes of [[-1], [1.5], [Number.MAX_SAFE_INTEGER + 1], [3]]) {
    await assert.rejects(
      buildRunTargets(['good.json'], indexes, root),
      (error: unknown) =>
        error instanceof TestSelectionError && error.errorCode === 'invalid-case-selection'
    )
  }
  await assert.rejects(buildRunTargets(['good.json', 'bad.json'], [0], root), TestSelectionError)
  await assert.rejects(buildRunTargets([], [0], root), TestSelectionError)
})
