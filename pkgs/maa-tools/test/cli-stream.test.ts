import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { createInterface } from 'node:readline'
import test, { type TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

import type { TestRunEvent, TestRunResult } from '../src/test/types.ts'
import { assertPublicResult } from './assertions.ts'

type StreamRecord = TestRunEvent | { type: 'run-result'; result: TestRunResult }
const toolsRoot = fileURLToPath(new URL('..', import.meta.url))
const cliSource = fileURLToPath(new URL('../src/cli.ts', import.meta.url))
const filesSource = new URL('../src/test/files.ts', import.meta.url).href
const entry = `
  import { createJiti } from 'jiti';
  if (process.send || process.channel) throw new Error('测试只能使用标准输入输出');
  const { runCliFromArgs } = await createJiti(import.meta.url, { fsCache: false }).import(process.env.MAA_CLI_STREAM_TEST_SOURCE);
  process.chdir(process.env.MAA_CLI_STREAM_TEST_ROOT);
  process.exitCode = await runCliFromArgs(JSON.parse(process.env.MAA_CLI_STREAM_TEST_ARGS));
`

async function fixture(t: TestContext, count = 3, name = '用例名称') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maa-jsonl-cli-stream-test-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const file = path.join(root, 'selected.json')
  await fs.writeFile(
    file,
    JSON.stringify({
      configs: { name: '显示名称', controller: 'Desktop', resource: 'Local' },
      cases: Array.from({ length: count }, (_, index) => ({
        name,
        image: `missing-${index}.png`,
        hits: ['A']
      }))
    })
  )
  await fs.writeFile(
    path.join(root, 'maatools.config.mts'),
    `
    import { loadTestCases } from ${JSON.stringify(filesSource)};
    console.log('CONFIG_LOG');
    console.info('CONFIG_INFO');
    process.stdout.write('CONFIG_DIRECT_WRITE\\n');
    export default {
      cwd: ${JSON.stringify(root)}, interfacePath: 'unused',
      test: { cases: async () => [await loadTestCases(${JSON.stringify(file)})] }
    };
  `
  )
  return { root, file }
}

async function run(root: string, args = ['test', '--jsonl']) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', entry], {
    cwd: toolsRoot,
    env: {
      ...process.env,
      MAA_CLI_STREAM_TEST_SOURCE: cliSource,
      MAA_CLI_STREAM_TEST_ROOT: root,
      MAA_CLI_STREAM_TEST_ARGS: JSON.stringify(args)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let stdout = ''
  let stderr = ''
  let parseError: unknown
  const records: StreamRecord[] = []
  child.stdout.setEncoding('utf8').on('data', chunk => {
    stdout += chunk
  })
  child.stderr.setEncoding('utf8').on('data', chunk => {
    stderr += chunk
  })
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
  lines.on('line', line => {
    try {
      records.push(JSON.parse(line) as StreamRecord)
    } catch (error) {
      parseError = error
    }
  })
  let timer: NodeJS.Timeout | undefined
  try {
    const { code, signal } = await new Promise<{
      code: number | null
      signal: NodeJS.Signals | null
    }>((resolve, reject) => {
      timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error(`CLI 未退出：${stderr}`))
      }, 15000)
      child.once('error', reject)
      child.once('close', (code, signal) => resolve({ code, signal }))
    })
    assert.ifError(parseError)
    assert.ok(stdout.endsWith('\n'), '每条记录必须以换行结束')
    assert.equal(records.length, stdout.split('\n').length - 1)
    return { code, signal, records, stdout, stderr }
  } finally {
    clearTimeout(timer)
    lines.close()
  }
}

function finalOf(output: Awaited<ReturnType<typeof run>>) {
  assert.equal(output.signal, null, output.stderr)
  assertPublicResult(output.records)
  assert.equal(output.records.filter(record => record.type === 'run-result').length, 1)
  const final = output.records.at(-1)!
  assert.equal(final.type, 'run-result')
  assert.ok('result' in final)
  return final.result
}

test('普通三管道逐条收到进度，最后唯一 run-result；配置日志只写 stderr', async t => {
  const { root, file } = await fixture(t)
  const output = await run(root)
  const final = finalOf(output)
  assert.equal(output.code, 1, output.stderr)
  assert.deepEqual(
    output.records.map(record => record.type),
    ['case-result', 'case-result', 'case-result', 'file-result', 'run-result']
  )
  const cases = output.records.filter(record => record.type === 'case-result')
  assert.deepEqual(
    cases.map(record => record.origin),
    [0, 1, 2].map(index => ({ file, case: index }))
  )
  for (const record of cases) {
    assert.deepEqual(record.result.files[0].selectedCases, [record.origin.case])
  }
  const fileResult = output.records.find(record => record.type === 'file-result')!
  assert.deepEqual(fileResult.result.files, final.files)
  assert.equal(Object.hasOwn(fileResult.result, 'casesWithoutSource'), false)
  for (const marker of ['CONFIG_LOG', 'CONFIG_INFO', 'CONFIG_DIRECT_WRITE']) {
    assert.ok(output.stderr.includes(marker))
    assert.ok(!output.stdout.includes(marker))
  }
})

test('raw argv 含 --jsonl 时，互斥或其它参数错误均只输出一个错误 run-result', async t => {
  const { root } = await fixture(t)
  for (const args of [
    ['test', '--jsonl', '--json'],
    ['test', '--json', '--jsonl'],
    ['test', '--list', '--jsonl'],
    ['test', '--jsonl', '--list'],
    ['test', '--unknown', '--jsonl'],
    ['test', '--jsonl', '--file', 'selected.json', '--case', '1.5']
  ]) {
    const output = await run(root, args)
    const final = finalOf(output)
    assert.equal(output.code, 2, output.stderr)
    assert.equal(output.records.length, 1)
    assert.equal(final.status, 'error')
    assert.equal(final.errorCode, 'invalid-cli-arguments')
    assert.equal(Object.hasOwn(final, 'casesWithoutSource'), false)
    assert.deepEqual(final.files, [])
    assert.ok(final.reason)
    assert.ok(Number.isFinite(final.durationMs))
  }
})

test('配置、选择和执行展开错误也用 run-result，不混入裸 JSON', async t => {
  const { root } = await fixture(t)
  await fs.writeFile(
    path.join(root, 'throwing.mts'),
    `
    console.info('BEFORE_THROW'); throw new Error('CONFIG_BOOM');
  `
  )
  await fs.writeFile(
    path.join(root, 'loader-error.mts'),
    `
    export default { interfacePath: 'unused', test: { cases: async () => { throw new Error('LOADER_BOOM'); } } };
  `
  )
  await fs.writeFile(path.join(root, 'invalid.mts'), 'export default 17;')
  await fs.writeFile(
    path.join(root, 'malformed-cases.mts'),
    `export default { interfacePath: 'unused', test: { cases: [null] } };`
  )
  for (const [args, errorCode] of [
    [['test', '--jsonl', 'missing.mts'], 'config-load-failed'],
    [['test', '--jsonl', 'throwing.mts'], 'config-load-failed'],
    [['test', '--jsonl', 'invalid.mts'], 'invalid-config'],
    [['test', '--jsonl', 'malformed-cases.mts'], 'invalid-test-config'],
    [['test', '--jsonl', '--file', 'selected.json', '--case', '3'], 'invalid-case-selection'],
    [['test', '--jsonl', 'loader-error.mts'], 'test-cases-load-failed']
  ] as const) {
    const output = await run(root, [...args])
    const final = finalOf(output)
    assert.equal(output.code, 1, output.stderr)
    assert.equal(output.records.length, 1)
    assert.equal(final.status, 'error')
    assert.equal(final.errorCode, errorCode)
  }
})

test('缺 test、缺来源、坏文件和缺文件的进度及最终错误均保留完整报告', async t => {
  const { root } = await fixture(t)
  await fs.writeFile(
    path.join(root, 'missing-test.mts'),
    `export default { interfacePath: 'unused' };`
  )
  await fs.writeFile(
    path.join(root, 'no-source.mts'),
    `export default { interfacePath: 'unused', test: { cases: [{
      configs: { controller: 'Desktop', resource: 'Local' },
      cases: [{ image: 'missing.png', hits: ['A'] }]
    }] } };`
  )
  await fs.writeFile(path.join(root, 'broken.json'), '{ invalid')
  for (const [args, errorCode] of [
    [['test', '--jsonl', 'missing-test.mts'], 'test-config-missing'],
    [['test', '--jsonl', '--file', 'selected.json', 'no-source.mts'], 'test-source-invalid'],
    [['test', '--jsonl', '--file', 'broken.json'], 'test-file-error'],
    [['test', '--jsonl', '--file', 'missing.json'], 'test-file-error']
  ] as const) {
    const output = await run(root, [...args])
    const final = finalOf(output)
    assert.equal(output.code, 1, output.stderr)
    assert.equal(final.status, 'error')
    assert.equal(final.errorCode, errorCode)
    assert.ok(Number.isFinite(final.durationMs))
  }
})

test('大于 64 KiB 的中文快照和最终报告均完整，名称中的换行不会拆成多条记录', async t => {
  const name = '中文名称\n'.repeat(10000)
  const { root } = await fixture(t, 1, name)
  const output = await run(root)
  const final = finalOf(output)
  assert.deepEqual(
    output.records.map(record => record.type),
    ['case-result', 'file-result', 'run-result']
  )
  assert.equal(final.files[0].cases[0].name, name)
  for (const line of output.stdout.trimEnd().split('\n')) {
    assert.ok(Buffer.byteLength(line) > 65536)
  }
})

test('全量和混合无来源CLI在计划阶段拒绝，只输出唯一最终错误', async t => {
  const { root, file } = await fixture(t, 1)
  for (const mixed of [false, true]) {
    const config = path.join(root, 'generated.mts')
    await fs.writeFile(
      config,
      `
      import { loadTestCases } from ${JSON.stringify(filesSource)};
      export default {
        cwd: ${JSON.stringify(root)}, interfacePath: 'unused',
        test: { cases: async () => {
          const loaded = ${mixed ? `await loadTestCases(${JSON.stringify(file)})` : 'null'};
          return [{
            configs: { name: '程序生成组', controller: 'Desktop', resource: 'Local' },
            source: '显示来源',
            cases: [...(loaded?.cases ?? []), { image: 'generated.png', hits: ['A'] }]
          }];
        } }
      };
    `
    )
    const output = await run(root, ['test', '--jsonl', config])
    const final = finalOf(output)
    assert.equal(output.code, 1, output.stderr)
    assert.equal(final.status, 'error')
    assert.equal(final.errorCode, 'test-source-invalid')
    assert.deepEqual(final.files, [])
    assert.deepEqual(
      output.records.map(record => record.type),
      ['run-result']
    )
    assert.equal((await fs.readdir(root)).includes('debug'), false)
  }
})

test('无匹配时没有伪造进度，只以 empty 的最终报告结束', async t => {
  const { root } = await fixture(t)
  await fs.writeFile(
    path.join(root, 'empty.mts'),
    `export default { interfacePath: 'unused', test: { cases: [] } };`
  )
  const output = await run(root, ['test', '--jsonl', 'empty.mts'])
  const final = finalOf(output)
  assert.equal(output.records.length, 1)
  assert.equal(final.status, 'empty')
  assert.equal(final.errorCode, 'no-tests-matched')
})
