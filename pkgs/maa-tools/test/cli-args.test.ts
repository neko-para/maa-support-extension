import assert from 'node:assert/strict'
import test from 'node:test'

import { parseCliArgs } from '../src/cli-args.ts'

test('位置参数：command 和 config-path，config 缺省是当前目录的 maatools.config.mts', () => {
  const parsed = parseCliArgs(['test', '/repo/maatools.config.mts'])
  assert.equal(parsed?.cmd, 'test')
  assert.equal(parsed?.config, '/repo/maatools.config.mts')
  assert.equal(parseCliArgs([])?.cmd, 'help')
  assert.match(parseCliArgs([])?.config ?? '', /maatools\.config\.mts$/)
})

test('--file 可以重复，--json 是开关', () => {
  const parsed = parseCliArgs(['test', '--file', 'a.json', '--file', 'b.json', '--json'])
  assert.deepEqual(parsed?.options.files, ['a.json', 'b.json'])
  assert.deepEqual(parsed?.options.caseIndices, [])
  assert.equal(parsed?.options.json, true)
})

test('重复 --case 选中同一文件的多个原始下标，重复下标去重', () => {
  const parsed = parseCliArgs([
    'test',
    '--file',
    'a.json',
    '--case',
    '3',
    '--case',
    '0',
    '--case',
    '3',
    '--json'
  ])
  assert.deepEqual(parsed?.options.caseIndices, [3, 0])
})

test('--case 必须整串都是十进制非负安全整数，不截断小数、指数或垃圾后缀', () => {
  const errors: string[] = []
  for (const value of ['x', '-1', '1.5', '1abc', '1e2', '+1', ' 1', '0x10', '9007199254740992']) {
    assert.equal(
      parseCliArgs(['test', '--file', 'a.json', '--case', value], error => errors.push(error)),
      null
    )
  }
  assert.equal(errors.length, 9)
  assert.deepEqual(
    parseCliArgs(['test', '--file', 'a.json', '--case', '0'])?.options.caseIndices,
    [0]
  )
  assert.deepEqual(
    parseCliArgs(['test', '--file', 'a.json', '--case', '9007199254740991'])?.options.caseIndices,
    [Number.MAX_SAFE_INTEGER]
  )
})

test('--case 必须和单个 --file 一起用，不能静默忽略或误用于多文件', () => {
  const ignoreError = () => {}
  assert.equal(parseCliArgs(['test', '--case', '0'], ignoreError), null)
  assert.equal(
    parseCliArgs(['test', '--file', 'a', '--file', 'b', '--case', '0'], ignoreError),
    null
  )
})

test('参数顺序随意，收集也保留自定义配置路径与平台过滤', () => {
  const parsed = parseCliArgs([
    '--list',
    'test',
    '--controller',
    'Desktop',
    '--resource',
    'Local',
    '--file',
    'x.json',
    'custom.mts'
  ])
  assert.equal(parsed?.cmd, 'test')
  assert.equal(parsed?.config, 'custom.mts')
  assert.deepEqual(parsed?.options.files, ['x.json'])
  assert.deepEqual(parsed?.options.controllers, ['Desktop'])
  assert.deepEqual(parsed?.options.resources, ['Local'])
})

test('未知参数、多余位置参数和缺失参数值都报错，不把后一个开关当值', () => {
  const ignoreError = () => {}
  for (const argv of [
    ['test', '--nope'],
    ['test', '--plan'],
    ['test', '--file'],
    ['test', '--file', '--json'],
    ['test', '--controller', '--list'],
    ['test', '--resource'],
    ['test', '--file', 'a', '--case'],
    ['test', 'a.mts', 'b.mts'],
    ['check', '--json']
  ]) {
    assert.equal(parseCliArgs(argv, ignoreError), null)
  }
})

test('--jsonl 可带用例选择，但与 --json/--list 互斥且只能用于 test', () => {
  const parsed = parseCliArgs(['test', '--jsonl', '--file', 'a.json', '--case', '0'])
  assert.equal(parsed?.options.jsonl, true)
  assert.deepEqual(parsed?.options.caseIndices, [0])
  assert.equal(parseCliArgs(['test'])?.options.jsonl, false)
  const ignoreError = () => {}
  for (const argv of [
    ['test', '--jsonl', '--json'],
    ['test', '--json', '--jsonl'],
    ['test', '--jsonl', '--list'],
    ['test', '--list', '--jsonl'],
    ['check', '--jsonl']
  ]) {
    assert.equal(parseCliArgs(argv, ignoreError), null)
  }
})

test('--version 返回 version 命令，不需要配置文件', () => {
  assert.equal(parseCliArgs(['--version'])?.cmd, 'version')
  assert.equal(parseCliArgs(['--version', 'extra'])?.cmd, 'version')
  assert.equal(parseCliArgs(['test', '--version'])?.cmd, 'version')
})

test('--list 是操作，可以和 --json 组合，但不能选择 --case', () => {
  for (const argv of [
    ['test', '--list', '--json'],
    ['test', '--json', '--list']
  ]) {
    const parsed = parseCliArgs(argv)
    assert.equal(parsed?.options.list, true)
    assert.equal(parsed?.options.json, true)
  }
  const errors: string[] = []
  for (const flags of [[], ['--json']]) {
    assert.equal(
      parseCliArgs(['test', '--list', ...flags, '--file', 'a.json', '--case', '0'], error =>
        errors.push(error)
      ),
      null
    )
  }
  assert.deepEqual(errors, [
    '--list 不支持 --case；请在运行时选择用例',
    '--list 不支持 --case；请在运行时选择用例'
  ])
  assert.equal(parseCliArgs(['test', '--list'])?.options.list, true)
  assert.equal(parseCliArgs(['test'])?.options.list, false)
})
