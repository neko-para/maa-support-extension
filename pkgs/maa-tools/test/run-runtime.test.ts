import { createJiti } from 'jiti'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { Module, createRequire, syncBuiltinESMExports } from 'node:module'
import * as os from 'node:os'
import * as path from 'node:path'
import test, { type TestContext } from 'node:test'

import type { RecoJob, RecoJobOutcome } from '../src/test/types.ts'
import type { FullConfig } from '../src/types/config.ts'
import { assertPublicResult } from './assertions.ts'

const require = createRequire(import.meta.url)
const runtime = createJiti(import.meta.url, { fsCache: false })

type PoolOptions = {
  maxWorkers: number
  forkOpts: { env: { MAAFW_LOG_DIR: string } }
}

async function fixture(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maa-pr92-runtime-boundaries-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  t.mock.method(console, 'log', () => {})
  t.mock.method(console, 'error', () => {})
  t.mock.method(process.stderr, 'write', () => true)
  const state = {
    hit: true,
    setupCalls: 0,
    poolOptions: [] as PoolOptions[],
    terminated: 0,
    logDirs: [] as string[],
    poolError: undefined as Error | undefined
  }
  const mockModule = (specifier: string, exports?: Record<string, unknown>) => {
    const id = runtime.resolve(specifier)
    const previous = require.cache[id]
    if (exports) {
      const mocked = new Module(id)
      mocked.exports = exports
      mocked.loaded = true
      require.cache[id] = mocked
    } else {
      delete require.cache[id]
    }
    t.after(() => {
      if (previous) {
        require.cache[id] = previous
      } else {
        delete require.cache[id]
      }
    })
  }
  mockModule('../src/utils/maa.ts', {
    setupMaa: async () => {
      state.setupCalls++
      return 'mock-maafw'
    },
    loadMaa: async (_modulePath: string, logDir: string) => {
      state.logDirs.push(logDir)
      assert.ok(path.resolve(logDir).startsWith(root + path.sep))
      // 模拟框架会递归清理传入的日志目录。
      await fs.rm(logDir, { recursive: true, force: true })
      await fs.mkdir(logDir, { recursive: true })
    }
  })
  mockModule('../src/utils/bundle.ts', {
    CachedContentLoader: class {},
    loadBundle: async () => ({
      root,
      resolvePaths: () => ['resource'],
      allControllerNames: () => [],
      stop() {}
    })
  })
  mockModule('workerpool', {
    pool: (_script: string, options: PoolOptions) => {
      if (state.poolError) {
        throw state.poolError
      }
      state.poolOptions.push(options)
      return {
        exec: async (_name: string, [job]: [RecoJob]): Promise<RecoJobOutcome> => ({
          results: job.nodes.map(node => ({
            imagePath: job.imagePath,
            imagePathRaw: job.imagePathRaw,
            node,
            hit: state.hit,
            detail: {
              name: node,
              algorithm: 'DirectHit',
              hit: state.hit,
              box: [0, 0, 1, 1] as maa.Rect,
              detail: null,
              raw: new ArrayBuffer(0),
              draws: []
            },
            pid: 1
          })),
          durationMs: 4
        }),
        terminate: async () => {
          state.terminated++
        }
      }
    }
  })
  mockModule('../src/test/run.ts')
  mockModule('../src/check/index.ts')
  const { loadTestCases } =
    await runtime.import<typeof import('../src/test/files')>('../src/test/files.ts')
  const file = path.join(root, 'selected.json')
  await fs.writeFile(path.join(root, 'exists.png'), '')
  await fs.writeFile(
    file,
    JSON.stringify({
      configs: { controller: 'C', resource: 'R' },
      cases: [{ image: 'exists.png', hits: ['A'] }]
    })
  )
  const cfg: FullConfig = {
    cwd: root,
    mode: 'json',
    interfacePath: 'unused',
    test: { cases: [(await loadTestCases(file))!], maaLogKeep: 1 }
  }
  const { runTestDetailed } =
    await runtime.import<typeof import('../src/test/run')>('../src/test/run.ts')
  return { root, state, cfg, runTestDetailed }
}

for (const status of ['passed', 'failed', 'error'] as const) {
  test(`旧日志删除报 EPERM/EBUSY 不覆盖本次 ${status} 结论`, async t => {
    const { root, state, cfg, runTestDetailed } = await fixture(t)
    const logRoot = path.join(root, 'debug')
    await fs.mkdir(path.join(logRoot, 'maa-tools-run-1'), { recursive: true })
    await fs.mkdir(path.join(logRoot, 'maa-tools-run-2'))
    const locked = path.join(logRoot, 'maa-tools-run-1')
    const code = status === 'failed' ? 'EBUSY' : 'EPERM'
    const cleanupError = Object.assign(new Error(`${code}: locked old log`), { code })
    const remove = fs.rm
    const mock = t.mock.method(fs, 'rm', async (...[target, options]: Parameters<typeof fs.rm>) => {
      if (String(target) === locked) {
        throw cleanupError
      }
      return remove(target, options)
    })
    syncBuiltinESMExports()
    t.after(() => {
      mock.mock.restore()
      syncBuiltinESMExports()
    })
    const warning = t.mock.method(console, 'warn', () => {})
    state.hit = status !== 'failed'
    state.poolError = status === 'error' ? new Error('WORKER_POOL_CREATION_FAILED') : undefined
    const result = await runTestDetailed(cfg)
    assertPublicResult(result)
    assert.equal(result.status, status)
    if (status === 'error') {
      assert.equal(result.errorCode, 'test-execution-failed')
      assert.equal(result.reason, 'WORKER_POOL_CREATION_FAILED')
    } else {
      assert.equal(result.errorCode, undefined)
      assert.equal(
        result.files[0].cases[0].platforms[0].result.verdict,
        status === 'passed' ? 'pass' : 'fail'
      )
      assert.equal(state.terminated, 1)
    }
    assert.ok(warning.mock.calls.length >= 2)
    assert.ok(warning.mock.calls.every(call => call.arguments[1] === cleanupError))
    assert.deepEqual((await fs.readdir(logRoot)).sort(), ['maa-tools-run-1', 'maa-tools-run-3'])
  })
}

for (const job of [undefined, 1, 3]) {
  test(`合法 test.job=${job ?? '默认'} 传给进程池并完成真实文件判定`, async t => {
    const { state, cfg, runTestDetailed } = await fixture(t)
    cfg.test!.job = job
    const result = await runTestDetailed(cfg)
    assertPublicResult(result)
    assert.equal(result.status, 'passed')
    assert.equal(state.setupCalls, 1)
    assert.equal(state.poolOptions.length, 1)
    assert.equal(
      state.poolOptions[0].maxWorkers,
      job ?? Math.max(1, Math.floor(os.cpus().length / 4))
    )
    assert.equal(state.terminated, 1)
  })
}

for (const maaLogDir of [undefined, 'custom-logs']) {
  test(`check 在${maaLogDir ?? '默认日志根'}中递归清理也保留测试轮次和活动标记`, async t => {
    const { root, cfg } = await fixture(t)
    const { runCheck } =
      await runtime.import<typeof import('../src/check/index')>('../src/check/index.ts')
    const { createRunLogDir, releaseRunLogDir } =
      await runtime.import<typeof import('../src/test/log-dir')>('../src/test/log-dir.ts')
    const logRoot = path.join(root, maaLogDir ?? 'debug')
    const active = await createRunLogDir(logRoot, 1)
    const finished = await createRunLogDir(logRoot, 1)
    await releaseRunLogDir(finished)
    await fs.writeFile(path.join(active, 'active.log'), 'active test log')
    await fs.writeFile(path.join(finished, 'finished.log'), 'finished test log')
    const marker = (await fs.readdir(logRoot)).find(name => name.endsWith('.active'))!
    const checkDir = path.join(logRoot, 'check')
    await fs.mkdir(checkDir)
    await fs.writeFile(path.join(checkDir, 'old-check.log'), '')
    assert.equal(await runCheck({ ...cfg, mode: 'stdio', maaLogDir, check: {} }), true)
    assert.deepEqual(await fs.readdir(checkDir), [])
    assert.equal(await fs.readFile(path.join(active, 'active.log'), 'utf8'), 'active test log')
    assert.equal(
      await fs.readFile(path.join(finished, 'finished.log'), 'utf8'),
      'finished test log'
    )
    assert.equal((await fs.stat(path.join(logRoot, marker))).isFile(), true)
    await releaseRunLogDir(active)
    assert.deepEqual((await fs.readdir(logRoot)).sort(), ['check', path.basename(finished)].sort())
  })
}
