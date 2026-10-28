import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import test, { type TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

import type { TestCliOptions } from '../src/cli-args.ts'

const toolsRoot = fileURLToPath(new URL('..', import.meta.url))
const cliSource = fileURLToPath(new URL('../src/cli.ts', import.meta.url))
const filesSource = new URL('../src/test/files.ts', import.meta.url).href
const entry = `
  import { createJiti } from 'jiti';
  const { runCli, runCliFromArgs } = await createJiti(import.meta.url, { fsCache: false }).import(process.env.MAA_CLI_TEST_SOURCE);
  process.chdir(process.env.MAA_CLI_TEST_ROOT);
  const args = JSON.parse(process.env.MAA_CLI_TEST_ARGS);
  process.exitCode = process.env.MAA_CLI_TEST_DIRECT_OPTIONS
    ? (await runCli('test', args[0] ?? 'maatools.config.mts', JSON.parse(process.env.MAA_CLI_TEST_DIRECT_OPTIONS)) ? 0 : 1)
    : await runCliFromArgs(args);
`

async function fixture(t: TestContext): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maa-pr92-cli-machine-test-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  return root
}

function run(root: string, args: string[], directOptions?: TestCliOptions) {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', entry], {
    cwd: toolsRoot,
    env: {
      ...process.env,
      MAA_CLI_TEST_SOURCE: cliSource,
      MAA_CLI_TEST_ROOT: root,
      MAA_CLI_TEST_ARGS: JSON.stringify(args),
      MAA_CLI_TEST_DIRECT_OPTIONS: directOptions ? JSON.stringify(directOptions) : ''
    },
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: 20000
  })
  assert.ifError(child.error)
  assert.notEqual(child.status, null, child.stderr)
  return child
}

function payloadOf(child: ReturnType<typeof run>) {
  assert.notEqual(child.stdout.trim(), '', child.stderr)
  try {
    return JSON.parse(child.stdout)
  } catch (error) {
    assert.fail(
      `stdout 不是一个完整 JSON：${child.stdout}\nstderr：${child.stderr}\n${String(error)}`
    )
  }
}

function assertError(child: ReturnType<typeof run>, errorCode: string) {
  const payload = payloadOf(child)
  assert.notEqual(child.status, 0)
  assert.equal(payload.schemaVersion, 1)
  assert.equal(payload.status, 'error')
  assert.equal(payload.errorCode, errorCode)
  assert.ok(typeof payload.reason === 'string' && payload.reason.length > 0)
  assert.ok(Array.isArray(payload.groups))
  assert.ok(Array.isArray(payload.files))
  assert.ok(Number.isFinite(payload.durationMs) && payload.durationMs >= 0)
  return payload
}

function testFileContent(count = 1) {
  return JSON.stringify({
    configs: { name: 'same display name', controller: 'Desktop', resource: 'Local' },
    cases: Array.from({ length: count }, (_, index) => ({ image: `${index}.png`, hits: ['A'] }))
  })
}

test('人类列表和 JSON 清单均从加载配置前把 console/stdout 日志转到 stderr', async t => {
  const root = await fixture(t)
  await fs.writeFile(path.join(root, 'dependency.mjs'), `console.info('DEPENDENCY_INFO');`)
  await fs.writeFile(
    path.join(root, 'custom.mts'),
    `
    import './dependency.mjs';
    console.log('CONFIG_LOG');
    console.info('CONFIG_INFO');
    console.debug('CONFIG_DEBUG');
    console.dir({ marker: 'CONFIG_DIR' });
    console.table([{ marker: 'CONFIG_TABLE' }]);
    process.stdout.write('CONFIG_DIRECT_WRITE\\n');
    export default { interfacePath: 'unused', test: { cases: [] } };
  `
  )
  for (const flags of [['--list'], ['--list', '--json']]) {
    const child = run(root, ['test', ...flags, 'custom.mts'])
    assert.equal(child.status, 0, child.stderr)
    if (flags.includes('--json')) {
      assert.deepEqual(payloadOf(child), { schemaVersion: 1, files: [] })
    } else {
      assert.equal(child.stdout, '没有收集到测试文件或用例。\n共 0 个文件，0 条用例。\n')
    }
    for (const marker of [
      'DEPENDENCY_INFO',
      'CONFIG_LOG',
      'CONFIG_INFO',
      'CONFIG_DEBUG',
      'CONFIG_DIR',
      'CONFIG_TABLE',
      'CONFIG_DIRECT_WRITE'
    ]) {
      assert.ok(child.stderr.includes(marker), `${marker} 没出现在 stderr`)
      assert.ok(!child.stdout.includes(marker))
    }
  }
})

test('list 从实际配置收集，并记录配置顶层加载的好文件和坏文件，不扫描其他目录', async t => {
  const root = await fixture(t)
  await fs.mkdir(path.join(root, 'selected'))
  await fs.mkdir(path.join(root, 'tests'))
  const selected = path.join(root, 'selected', 'custom_name.json')
  const broken = path.join(root, 'selected', 'broken.json')
  await fs.writeFile(selected, testFileContent())
  await fs.writeFile(broken, '{ broken')
  await fs.writeFile(path.join(root, 'tests', 'test_unselected.json'), testFileContent())
  await fs.writeFile(
    path.join(root, 'custom.mts'),
    `
    import { loadTestCases } from ${JSON.stringify(filesSource)};
    const chosen = await loadTestCases(${JSON.stringify(selected)});
    await loadTestCases(${JSON.stringify(broken)});
    export default { cwd: ${JSON.stringify(root)}, interfacePath: 'unused', test: { cases: [chosen] } };
  `
  )
  const child = run(root, ['test', '--list', '--json', 'custom.mts'])
  assert.equal(child.status, 0, child.stderr)
  const payload = payloadOf(child)
  assert.deepEqual(
    payload.files.map((file: { file: string }) => file.file).sort(),
    [broken, selected].sort()
  )
  assert.ok(payload.files.find((file: { file: string }) => file.file === broken).error)
  assert.equal(
    payload.files.find((file: { file: string }) => file.file === selected).cases[0].index,
    0
  )
})

test('人类列表与 JSON 清单同源，保留筛选后的原始下标和配置 mode，并列出坏文件', async t => {
  const root = await fixture(t)
  const selected = path.join(root, 'selected.json')
  const broken = path.join(root, 'broken.json')
  const content = JSON.parse(testFileContent(3))
  content.cases[0].name = '第一条'
  await fs.writeFile(selected, JSON.stringify(content))
  await fs.writeFile(broken, '{ invalid')
  await fs.writeFile(
    path.join(root, 'maatools.config.mts'),
    `
    import { loadTestCases } from ${JSON.stringify(filesSource)};
    const cfg = {
      cwd: ${JSON.stringify(root)}, mode: 'stdio', interfacePath: 'unused',
      test: { cases: async () => {
        if (cfg.mode !== 'stdio') throw new Error('收集不能因显示格式改变配置 mode');
        const selected = await loadTestCases(${JSON.stringify(selected)});
        await loadTestCases(${JSON.stringify(broken)});
        return [{ ...selected, cases: [selected.cases[2], selected.cases[0]] }];
      } }
    };
    export default cfg;
  `
  )
  const human = run(root, ['test', '--list'])
  const json = run(root, ['test', '--list', '--json'])
  assert.equal(human.status, 0, human.stderr)
  assert.equal(json.status, 0, json.stderr)
  const collection = payloadOf(json)
  assert.deepEqual(
    collection.files
      .find((file: { file: string }) => file.file === selected)
      .cases.map((item: { index: number }) => item.index)
      .sort(),
    [0, 2]
  )
  assert.ok(human.stdout.includes('selected.json\n'))
  assert.ok(human.stdout.includes('  [0] 第一条 (0.png)\n'))
  assert.ok(human.stdout.includes('  [2] 2.png\n'))
  assert.ok(!human.stdout.includes('[1]'))
  assert.ok(human.stdout.includes('broken.json\n  错误：JSON 解析失败'))
  assert.ok(human.stdout.endsWith('共 2 个文件，2 条用例，1 个文件有错误。\n'))
  assert.ok(!human.stderr.includes('共 2 个文件'))
  assert.equal((await fs.readdir(root)).includes('debug'), false)
})

test('单 --list 的配置和参数错误只给人话，收集错误也不输出 JSON', async t => {
  const root = await fixture(t)
  await fs.writeFile(
    path.join(root, 'throw.mts'),
    `console.log('BEFORE_THROW'); throw new Error('CONFIG_BOOM');`
  )
  await fs.writeFile(
    path.join(root, 'missing-test.mts'),
    `export default { interfacePath: 'unused' };`
  )
  for (const [args, status] of [
    [['test', '--list', 'missing.mts'], 1],
    [['test', '--list', 'throw.mts'], 1],
    [['test', '--list', '--file', 'a.json', '--case', '0'], 2],
    [['test', '--list', '--resource'], 2]
  ] as const) {
    const child = run(root, [...args])
    assert.equal(child.status, status, child.stderr)
    assert.equal(child.stdout, '')
    assert.ok(child.stderr.length > 0)
  }
  const failed = run(root, ['test', '--list', 'missing-test.mts'])
  assert.equal(failed.status, 1)
  assert.match(failed.stdout, /共 0 个文件，0 条用例/)
  assert.match(failed.stderr, /收集失败：配置中缺少 test/)
  assert.ok(!failed.stdout.includes('schemaVersion'))
})

test('runCli 直接调用也允许 list+json，并拒绝 list+case 和 jsonl 混用', async t => {
  const root = await fixture(t)
  await fs.writeFile(
    path.join(root, 'maatools.config.mts'),
    `export default { interfacePath: 'unused', test: { cases: [] } };`
  )
  const human = run(root, [], { list: true })
  assert.equal(human.status, 0, human.stderr)
  assert.match(human.stdout, /没有收集到测试文件或用例/)
  const json = run(root, [], { list: true, json: true })
  assert.equal(json.status, 0, json.stderr)
  assert.deepEqual(payloadOf(json), { schemaVersion: 1, files: [] })
  for (const options of [
    { json: true, jsonl: true },
    { list: true, jsonl: true }
  ]) {
    const child = run(root, [], options)
    assert.equal(child.status, 1)
    const frame = payloadOf(child)
    assert.equal(frame.type, 'run-result')
    assert.equal(frame.result.errorCode, 'invalid-cli-arguments')
  }
  const invalidHuman = run(root, [], { list: true, files: ['a.json'], caseIndices: [0] })
  assert.equal(invalidHuman.status, 1)
  assert.equal(invalidHuman.stdout, '')
  assert.match(invalidHuman.stderr, /--list 不支持 --case/)
  assertError(
    run(root, [], { list: true, json: true, files: ['a.json'], caseIndices: [0] }),
    'invalid-cli-arguments'
  )
})

test('配置缺失、配置抛错和非法配置对象，显式 JSON 均返回完整错误', async t => {
  const root = await fixture(t)
  await fs.writeFile(
    path.join(root, 'throwing.mts'),
    `console.info('BEFORE_THROW'); throw new Error('CONFIG_BOOM');`
  )
  await fs.writeFile(path.join(root, 'invalid.mts'), 'export default 17;')
  for (const flags of [['--json'], ['--list', '--json']]) {
    assertError(run(root, ['test', ...flags, 'missing.mts']), 'config-load-failed')
    const throwing = run(root, ['test', ...flags, 'throwing.mts'])
    assertError(throwing, 'config-load-failed')
    assert.match(throwing.stderr, /BEFORE_THROW/)
    assertError(run(root, ['test', ...flags, 'invalid.mts']), 'invalid-config')
  }
})

test('机器模式参数错误也返回完整 JSON，不加载配置且保持参数错误退出码', async t => {
  const root = await fixture(t)
  for (const args of [
    ['test', '--json', '--file', 'a.json', '--case', '1.5'],
    ['test', '--json', '--file', 'a.json', '--case', '1abc'],
    ['test', '--list', '--json', '--file', 'a.json', '--case', '0'],
    ['test', '--list', '--json', '--controller'],
    ['test', '--json', '--file', '--json']
  ]) {
    const child = run(root, args)
    assertError(child, 'invalid-cli-arguments')
    assert.equal(child.status, 2)
  }
})

test('普通运行没有 --case 时不报选择错误，零匹配返回 empty/no-tests-matched', async t => {
  const root = await fixture(t)
  await fs.writeFile(
    path.join(root, 'maatools.config.mts'),
    `
    console.info('RUN_CONFIG_LOG');
    export default { interfacePath: 'unused', test: { cases: [] } };
  `
  )
  const child = run(root, ['test', '--json'])
  const payload = payloadOf(child)
  assert.equal(child.status, 1)
  assert.equal(payload.schemaVersion, 1)
  assert.equal(payload.status, 'empty')
  assert.equal(payload.errorCode, 'no-tests-matched')
  assert.deepEqual(payload.groups, [])
  assert.deepEqual(payload.files, [])
  assert.ok(Number.isFinite(payload.durationMs))
  assert.match(child.stderr, /RUN_CONFIG_LOG/)
})

test('越界选择返回明确错误，多个 --case 保留指定原始下标，--file 相对调用目录', async t => {
  const root = await fixture(t)
  await fs.writeFile(path.join(root, 'chosen.json'), testFileContent(3))
  await fs.writeFile(
    path.join(root, 'maatools.config.mts'),
    `
    export default { cwd: ${JSON.stringify(path.join(root, 'different-config-cwd'))}, interfacePath: 'unused', test: { cases: [] } };
  `
  )
  assertError(
    run(root, ['test', '--json', '--file', 'chosen.json', '--case', '3']),
    'invalid-case-selection'
  )
  const child = run(root, ['test', '--json', '--file', 'chosen.json', '--case', '2', '--case', '0'])
  const payload = payloadOf(child)
  assert.equal(payload.status, 'empty')
  assert.equal(payload.files[0].file, path.join(root, 'chosen.json'))
  assert.deepEqual(payload.files[0].selectedCases.slice().sort(), [0, 2])
  assert.deepEqual(
    payload.files[0].cases.map((item: { index: number }) => item.index).sort(),
    [0, 2]
  )
})

test('实际用例函数抛错和展开组形状错误，list/json 都给完整机器错误', async t => {
  const root = await fixture(t)
  await fs.writeFile(
    path.join(root, 'throwing-cases.mts'),
    `
    export default { interfacePath: 'unused', test: { cases: async () => {
      console.info('LOADER_LOG'); throw new Error('LOADER_BOOM');
    } } };
  `
  )
  await fs.writeFile(
    path.join(root, 'malformed-cases.mts'),
    `
    export default { interfacePath: 'unused', test: { cases: [null] } };
  `
  )
  for (const flags of [['--list', '--json'], ['--json']]) {
    const throwing = run(root, ['test', ...flags, 'throwing-cases.mts'])
    assertError(throwing, 'test-cases-load-failed')
    assert.match(throwing.stderr, /LOADER_LOG/)
    assertError(run(root, ['test', ...flags, 'malformed-cases.mts']), 'invalid-test-config')
  }
})

test('缺少 test 或没有来源的程序组，list 返回完整错误而非不完整清单', async t => {
  const root = await fixture(t)
  await fs.writeFile(
    path.join(root, 'missing-test.mts'),
    `export default { interfacePath: 'unused' };`
  )
  await fs.writeFile(
    path.join(root, 'no-source.mts'),
    `
    export default { interfacePath: 'unused', test: { cases: [{
      configs: { controller: 'Desktop', resource: 'Local' }, cases: [{ image: 'x.png', hits: ['A'] }]
    }] } };
  `
  )
  assertError(run(root, ['test', '--list', '--json', 'missing-test.mts']), 'test-config-missing')
  assertError(run(root, ['test', '--list', '--json', 'no-source.mts']), 'collection-source-missing')
})

test('--version 始终输出版本字符串，不需要配置也不输出 JSON', async t => {
  const root = await fixture(t)
  const child = run(root, ['--version'])
  assert.equal(child.status, 0, child.stderr)
  assert.match(child.stdout, /^\d+\.\d+\.\d+(?:-[\w.-]+)?\n$/)
  assert.equal(child.stderr, '')
})
