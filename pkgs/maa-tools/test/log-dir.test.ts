import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import * as os from 'node:os'
import * as path from 'node:path'
import { createInterface } from 'node:readline'
import test, { type TestContext } from 'node:test'

import {
  KEEP_RUN_LOG_DIRS,
  createRunLogDir,
  nextRunDirNumber,
  releaseRunLogDir,
  staleRunDirNames,
  testLogRoot
} from '../src/test/log-dir.ts'

test('目录里没有轮次目录时从 1 开始编号', () => {
  assert.equal(nextRunDirNumber([]), 1)
  assert.equal(nextRunDirNumber(['error_details.json', 'maa-0-416']), 1)
})

test('编号取现有最大值加一，中间有空洞也不回头', () => {
  assert.equal(nextRunDirNumber(['maa-tools-run-1', 'maa-tools-run-2', 'maa-tools-run-5']), 6)
})

test('只认 maa-tools-run-<数字>，别的名字不参与编号和清理', () => {
  const names = [
    'maa-0-416',
    'maa-run-3',
    'maa-tools-run-abc',
    'maa-tools-run-',
    'maa-tools-run-2-extra'
  ]

  assert.equal(nextRunDirNumber(names), 1)
  assert.deepEqual(staleRunDirNames(names), [])
})

test('按编号数值比较新旧，maa-tools-run-2 比 maa-tools-run-10 旧', () => {
  const names = ['maa-tools-run-2', 'maa-tools-run-10', 'maa-tools-run-1', 'maa-tools-run-3']

  assert.deepEqual(staleRunDirNames(names, 3), ['maa-tools-run-1'])
})

test('轮次超过保留数时多删几轮，正好够数不删', () => {
  assert.deepEqual(
    staleRunDirNames(
      [
        'maa-tools-run-1',
        'maa-tools-run-2',
        'maa-tools-run-3',
        'maa-tools-run-4',
        'maa-tools-run-5'
      ],
      3
    ),
    ['maa-tools-run-1', 'maa-tools-run-2']
  )
  assert.deepEqual(
    staleRunDirNames(['maa-tools-run-1', 'maa-tools-run-2', 'maa-tools-run-3'], 3),
    []
  )
})

test('保留轮数可以指定，至少留 1 轮', () => {
  assert.deepEqual(staleRunDirNames(['maa-tools-run-1', 'maa-tools-run-2'], 1), ['maa-tools-run-1'])
  assert.deepEqual(staleRunDirNames(['maa-tools-run-1'], 0), ['maa-tools-run-1'])
})

test('默认保留 10 轮', () => {
  assert.equal(KEEP_RUN_LOG_DIRS, 10)

  const names = Array.from({ length: 12 }, (_, index) => `maa-tools-run-${index + 1}`)
  assert.deepEqual(staleRunDirNames(names), ['maa-tools-run-1', 'maa-tools-run-2'])
})

test('日志根目录：默认 <cwd>/debug，配置了 maaLogDir 优先（相对 <cwd> 解析）', () => {
  assert.equal(testLogRoot({ cwd: '/repo' }), path.resolve('/repo', 'debug'))
  assert.equal(
    testLogRoot({ cwd: '/repo', maaLogDir: 'tests/maatools' }),
    path.resolve('/repo', 'tests/maatools')
  )
  assert.equal(testLogRoot({}), path.resolve(process.cwd(), 'debug'))
})

async function logFixture(t: TestContext): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maa-pr92-cli-log-test-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  return root
}

const logModule = new URL('../src/test/log-dir.ts', import.meta.url).href

function childScript(body: string): string {
  return `import { createRunLogDir, releaseRunLogDir } from ${JSON.stringify(logModule)}; ${body}`
}

test('多个活动轮次不计入keep，释放后只保留最近的已结束轮次，释放幂等', async t => {
  const root = await logFixture(t)
  const first = await createRunLogDir(root, 1)
  await fs.writeFile(path.join(first, 'running.log'), 'still running')
  const second = await createRunLogDir(root, 1)
  await releaseRunLogDir(second)
  const third = await createRunLogDir(root, 1)
  await releaseRunLogDir(third)
  assert.equal(await fs.readFile(path.join(first, 'running.log'), 'utf8'), 'still running')
  assert.deepEqual((await fs.readdir(root)).filter(name => /^maa-tools-run-/.test(name)).sort(), [
    path.basename(first),
    path.basename(third)
  ])
  await releaseRunLogDir(first)
  await releaseRunLogDir(first)
  assert.deepEqual(await fs.readdir(root), [path.basename(third)])
})

test('同一进程并发分配不撞号，未释放目录都受保护', async t => {
  const root = await logFixture(t)
  const dirs = await Promise.all(Array.from({ length: 12 }, () => createRunLogDir(root, 1)))
  assert.equal(new Set(dirs).size, 12)
  for (const dir of dirs) {
    assert.equal((await fs.stat(dir)).isDirectory(), true)
  }
  await Promise.all(dirs.map(releaseRunLogDir))
  const names = await fs.readdir(root)
  assert.equal(names.filter(name => /^maa-tools-run-/.test(name)).length, 1)
  assert.equal(names.filter(name => name.endsWith('.active')).length, 0)
})

test('另一进程的活动轮次不被删除，取消该进程后下轮回收失效标记', { timeout: 15000 }, async t => {
  const root = await logFixture(t)
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      childScript(`
    const dir = await createRunLogDir(process.argv[1], 1);
    console.log(dir);
    process.stdin.resume();
  `),
      root
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] }
  )
  const lines = createInterface({ input: child.stdout })
  try {
    const [activeDir] = (await once(lines, 'line')) as [string]
    const recent = await createRunLogDir(root, 1)
    await releaseRunLogDir(recent)
    assert.equal((await fs.stat(activeDir)).isDirectory(), true)
    const stopped = once(child, 'exit')
    child.kill('SIGKILL')
    await stopped
    const next = await createRunLogDir(root, 1)
    await releaseRunLogDir(next)
    assert.deepEqual(await fs.readdir(root), [path.basename(next)])
  } finally {
    lines.close()
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = once(child, 'exit')
      child.kill('SIGKILL')
      await stopped
    }
  }
})

test('进程正常退出无需等待下一轮也会移除自身活动标记', async t => {
  const root = await logFixture(t)
  const child = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      childScript(`
    console.log(await createRunLogDir(process.argv[1], 1));
  `),
      root
    ],
    { encoding: 'utf8', timeout: 10000 }
  )
  assert.equal(child.status, 0, child.stderr)
  const names = await fs.readdir(root)
  assert.deepEqual(names, [path.basename(child.stdout.trim())])
})

test('清理不删除非轮次目录，也不跟随轮次名字的符号链接', async t => {
  const root = await logFixture(t)
  const unrelated = path.join(root, 'unrelated')
  await fs.mkdir(unrelated)
  await fs.writeFile(path.join(unrelated, 'keep.log'), 'keep')
  await fs.symlink(unrelated, path.join(root, 'maa-tools-run-1'), 'dir')
  const run = await createRunLogDir(root, 1)
  await releaseRunLogDir(run)
  assert.equal(await fs.readFile(path.join(unrelated, 'keep.log'), 'utf8'), 'keep')
  assert.equal((await fs.lstat(path.join(root, 'maa-tools-run-1'))).isSymbolicLink(), true)
})

function syncMock(t: TestContext, restore: () => void) {
  syncBuiltinESMExports()
  t.after(() => {
    restore()
    syncBuiltinESMExports()
  })
}

for (const code of ['EPERM', 'EBUSY']) {
  test(`${code} 锁住一轮旧日志时，创建与释放仍完成并继续清理其他旧目录`, async t => {
    const root = await logFixture(t)
    for (let number = 1; number <= 4; number++) {
      await fs.mkdir(path.join(root, `maa-tools-run-${number}`))
    }
    const blocked = path.join(root, 'maa-tools-run-1')
    const failure = Object.assign(new Error(`${code}: locked log`), { code })
    const remove = fs.rm
    const mock = t.mock.method(fs, 'rm', async (...[target, options]: Parameters<typeof fs.rm>) => {
      if (String(target) === blocked) {
        throw failure
      }
      return remove(target, options)
    })
    syncMock(t, () => mock.mock.restore())
    const warning = t.mock.method(console, 'warn', () => {})
    const run = await createRunLogDir(root, 1)
    assert.deepEqual(
      (await fs.readdir(root)).filter(name => name.startsWith('maa-tools-run-')).sort(),
      ['maa-tools-run-1', 'maa-tools-run-4', 'maa-tools-run-5']
    )
    await releaseRunLogDir(run)
    assert.deepEqual((await fs.readdir(root)).sort(), ['maa-tools-run-1', 'maa-tools-run-5'])
    assert.ok(warning.mock.calls.length >= 2)
    for (const { arguments: args } of warning.mock.calls) {
      assert.match(String(args[0]), new RegExp(path.basename(blocked)))
      assert.equal(args[1], failure)
    }
  })
}

test('清理阶段无法读取日志根时只警告，新轮次仍可创建和释放', async t => {
  const root = await logFixture(t)
  const failure = Object.assign(new Error('EBUSY: directory scan'), { code: 'EBUSY' })
  const readdir = fs.readdir
  const mock = t.mock.method(
    fs,
    'readdir',
    (...[target, options]: Parameters<typeof fs.readdir>) => {
      if (String(target) === root && typeof options === 'object' && options?.withFileTypes) {
        return Promise.reject(failure)
      }
      return readdir(target, options)
    }
  )
  syncMock(t, () => mock.mock.restore())
  const warning = t.mock.method(console, 'warn', () => {})
  const run = await createRunLogDir(root, 1)
  await releaseRunLogDir(run)
  assert.deepEqual(await fs.readdir(root), [path.basename(run)])
  assert.equal(warning.mock.calls.length, 2)
  assert.ok(warning.mock.calls.every(call => call.arguments[1] === failure))
})

test('活动标记暂时无法释放时继续保护本轮，后续释放可以重试', async t => {
  const root = await logFixture(t)
  const first = await createRunLogDir(root, 1)
  const marker = (await fs.readdir(root)).find(name => name.endsWith('.active'))!
  const remove = fs.rm
  const mock = t.mock.method(fs, 'rm', async (...[target, options]: Parameters<typeof fs.rm>) => {
    if (String(target) === path.join(root, marker)) {
      throw Object.assign(new Error('EBUSY: active marker'), { code: 'EBUSY' })
    }
    return remove(target, options)
  })
  syncMock(t, () => mock.mock.restore())
  t.mock.method(console, 'warn', () => {})
  await releaseRunLogDir(first)
  const second = await createRunLogDir(root, 1)
  await releaseRunLogDir(second)
  assert.equal((await fs.stat(first)).isDirectory(), true)
  mock.mock.restore()
  syncBuiltinESMExports()
  await releaseRunLogDir(first)
  assert.deepEqual(await fs.readdir(root), [path.basename(second)])
})

test('新活动标记创建失败仍抛原错误，不假装已分配日志目录', async t => {
  const root = await logFixture(t)
  const failure = Object.assign(new Error('EPERM: create marker'), { code: 'EPERM' })
  const writeFile = fs.writeFile
  const mock = t.mock.method(
    fs,
    'writeFile',
    async (...[target, data, options]: Parameters<typeof fs.writeFile>) => {
      if (String(target).endsWith('.active')) {
        throw failure
      }
      return writeFile(target, data, options)
    }
  )
  syncMock(t, () => mock.mock.restore())
  await assert.rejects(createRunLogDir(root), error => error === failure)
  assert.deepEqual(await fs.readdir(root), [])
})

test('新轮次目录创建失败时，回收标记的错误不能覆盖原创建错误', async t => {
  const root = await logFixture(t)
  const failure = Object.assign(new Error('EPERM: create run directory'), { code: 'EPERM' })
  const mkdir = fs.mkdir
  const make = t.mock.method(fs, 'mkdir', (...[target, options]: Parameters<typeof fs.mkdir>) => {
    if (path.basename(String(target)).startsWith('maa-tools-run-')) {
      return Promise.reject(failure)
    }
    return mkdir(target, options)
  })
  const remove = fs.rm
  const cleanup = t.mock.method(
    fs,
    'rm',
    async (...[target, options]: Parameters<typeof fs.rm>) => {
      if (String(target).endsWith('.active')) {
        throw Object.assign(new Error('EBUSY: remove marker'), { code: 'EBUSY' })
      }
      return remove(target, options)
    }
  )
  syncMock(t, () => {
    make.mock.restore()
    cleanup.mock.restore()
  })
  const warning = t.mock.method(console, 'warn', () => {})
  await assert.rejects(createRunLogDir(root), error => error === failure)
  assert.equal(
    (await fs.readdir(root)).some(name => name.startsWith('maa-tools-run-')),
    false
  )
  assert.equal(warning.mock.calls.length, 1)
})
