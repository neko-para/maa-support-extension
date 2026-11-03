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
  forkOpts: { env: NodeJS.ProcessEnv }
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
    prepareError: undefined as string | undefined,
    prepareKind: 'agent' as 'agent' | 'setup',
    jobError: undefined as string | undefined,
    jobErrorKind: undefined as 'setup' | 'agent' | undefined,
    hang: undefined as 'prepare' | 'performReco' | undefined,
    timeoutError: undefined as 'prepare' | 'performReco' | undefined,
    rejectExec: undefined as Error | undefined,
    prepareReject: undefined as Error | undefined,
    prepareUndefined: false,
    timeoutCalls: [] as [string, number][],
    terminateForce: undefined as boolean | undefined,
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
      return { modulePath: 'mock-maafw', version: 'mock-version' }
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
        exec: (name: string, args: unknown[]) => {
          const agents = JSON.parse(
            (options.forkOpts.env.MAATOOLS_AGENTS as string | undefined) ?? '[]'
          ) as unknown[]
          const result = (async (): Promise<unknown> => {
            if (name === 'prepare') {
              if (state.prepareReject) {
                throw state.prepareReject
              }
              if (state.prepareUndefined) {
                return undefined
              }
              return state.prepareError === undefined
                ? { ok: true, agentsStarted: agents.length > 0 }
                : { ok: false, kind: state.prepareKind, error: state.prepareError }
            }
            if (state.hang === name) {
              // 模拟 agent/native 调用永久挂起，父侧 watchdog 必须兜底。
              return new Promise(() => {})
            }
            if (state.rejectExec) {
              throw state.rejectExec
            }
            if (state.jobError) {
              return {
                results: [],
                durationMs: 0,
                error: state.jobError,
                errorKind: state.jobErrorKind
              } satisfies RecoJobOutcome
            }
            const [job] = args as [RecoJob]
            return {
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
            } satisfies RecoJobOutcome
          })()
          // workerpool 的 exec 返回带 timeout 的 promise，且从任务真正开始执行时计时。
          const tracked = result as Promise<unknown> & {
            timeout: (delay: number) => Promise<unknown>
          }
          tracked.timeout = (delay: number) => {
            state.timeoutCalls.push([name, delay])
            if (state.timeoutError === name) {
              const error = new Error(`Promise timed out after ${delay} ms`)
              error.name = 'TimeoutError'
              return Promise.reject(error)
            }
            return result
          }
          return tracked
        },
        terminate: async (force?: boolean) => {
          state.terminated++
          state.terminateForce = force === true
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

test('worker 继承父进程环境变量，工具自身的框架配置优先', async t => {
  const { state, cfg, runTestDetailed } = await fixture(t)
  const sentinel = 'MAATOOLS_TEST_SENTINEL'
  const previousSentinel: string | undefined = process.env[sentinel]
  const previousLogDir: string | undefined = process.env.MAAFW_LOG_DIR
  process.env[sentinel] = 'inherited'
  process.env.MAAFW_LOG_DIR = 'parent-provided'
  t.after(() => {
    for (const [key, value] of [
      [sentinel, previousSentinel],
      ['MAAFW_LOG_DIR', previousLogDir]
    ] as const) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })
  const result = await runTestDetailed(cfg)
  assertPublicResult(result)
  assert.equal(result.status, 'passed')
  assert.equal(state.poolOptions.length, 1)
  const env = state.poolOptions[0].forkOpts.env
  assert.equal(env[sentinel], 'inherited')
  assert.notEqual(env.MAAFW_LOG_DIR, 'parent-provided')
  assert.deepEqual(JSON.parse(env.MAATOOLS_NODES!), ['A'])
  assert.deepEqual(JSON.parse(env.MAATOOLS_AGENTS!), [])
})

test('识别阶段框架准备失败不归咎于 agent', async t => {
  const { state, cfg, runTestDetailed } = await fixture(t)
  state.jobError = 'MaaFW resource load failed'
  state.jobErrorKind = 'setup'
  const result = await runTestDetailed(cfg)
  assertPublicResult(result)
  assert.equal(result.status, 'error')
  assert.equal(result.errorCode, 'test-execution-failed')
})

test('旧 worker 未实现 prepare 时给出明确错误', async t => {
  const { state, cfg, runTestDetailed } = await fixture(t)
  state.prepareReject = new Error("Method 'prepare' not found")
  const result = await runTestDetailed(cfg)
  assertPublicResult(result)
  assert.equal(result.status, 'error')
  assert.equal(result.errorCode, 'test-execution-failed')
  assert.match(result.reason ?? '', /worker 未实现 prepare/)
})

test('prepare 没有返回值时按执行错误处理', async t => {
  const { state, cfg, runTestDetailed } = await fixture(t)
  state.prepareUndefined = true
  const result = await runTestDetailed(cfg)
  assertPublicResult(result)
  assert.equal(result.status, 'error')
  assert.equal(result.errorCode, 'test-execution-failed')
  assert.match(result.reason ?? '', /worker 未返回准备结果/)
})

test('worker 准备挂死时 watchdog 按执行错误中止', async t => {
  const { state, cfg, runTestDetailed } = await fixture(t)
  state.hang = 'prepare'
  state.timeoutError = 'prepare'
  cfg.test!.agent = [{ child_exec: 'node', timeoutMs: 50 }]
  const result = await runTestDetailed(cfg)
  assertPublicResult(result)
  assert.equal(result.status, 'error')
  assert.equal(result.errorCode, 'test-execution-failed')
  assert.match(result.reason ?? '', /准备超时（120000ms）/)
  assert.equal(state.terminated, 1)
  assert.equal(state.terminateForce, true)
})

test('识别挂死时 watchdog 按 agent 错误中止', async t => {
  const { state, cfg, runTestDetailed } = await fixture(t)
  state.hang = 'performReco'
  state.timeoutError = 'performReco'
  cfg.test!.agent = [{ child_exec: 'node', timeoutMs: 50 }]
  const result = await runTestDetailed(cfg)
  assertPublicResult(result)
  assert.equal(result.status, 'error')
  assert.equal(result.errorCode, 'test-agent-failed')
  assert.match(result.reason ?? '', /超时（1000ms）/)
  assert.equal(state.terminated, 1)
  assert.equal(state.terminateForce, true)
})

test('没有启动 agent 时不启用识别 watchdog，纯 pipeline 套件不受排队影响', async t => {
  const { state, cfg, runTestDetailed } = await fixture(t)
  const result = await runTestDetailed(cfg)
  assertPublicResult(result)
  assert.equal(result.status, 'passed')
  // 只对 prepare 设了超时，performReco 没有 timeout 包裹。
  assert.deepEqual(state.timeoutCalls, [['prepare', 120_000]])
})

test('启动 agent 后识别 watchdog 使用默认 60s，终止时始终 force', async t => {
  const { state, cfg, runTestDetailed } = await fixture(t)
  cfg.test!.agent = [{ child_exec: 'node' }]
  const result = await runTestDetailed(cfg)
  assertPublicResult(result)
  assert.equal(result.status, 'passed')
  assert.deepEqual(state.timeoutCalls, [
    ['prepare', 120_000],
    ['performReco', 60_000]
  ])
  assert.equal(state.terminateForce, true)
})

test('worker 崩溃/池拒绝按执行错误返回，不退化成用例失败', async t => {
  const { state, cfg, runTestDetailed } = await fixture(t)
  state.rejectExec = new Error('worker crashed')
  const result = await runTestDetailed(cfg)
  assertPublicResult(result)
  assert.equal(result.status, 'error')
  assert.equal(result.errorCode, 'test-execution-failed')
  assert.match(result.reason ?? '', /worker 执行失败：worker crashed/)
  assert.equal(state.terminateForce, true)
})

test('test.agent 显式配置会解析进 worker 环境变量', async t => {
  const { state, cfg, runTestDetailed } = await fixture(t)
  cfg.test!.agent = [{ child_exec: 'node', child_args: ['agent.mjs'], env: { FOO: 'bar' } }]
  const result = await runTestDetailed(cfg)
  assertPublicResult(result)
  assert.equal(result.status, 'passed')
  const agents = JSON.parse(state.poolOptions[0].forkOpts.env.MAATOOLS_AGENTS!) as Array<{
    childExec: string
    childArgs: string[]
    env: Record<string, string>
  }>
  assert.equal(agents.length, 1)
  assert.equal(agents[0].childExec, 'node')
  assert.deepEqual(agents[0].childArgs, ['agent.mjs'])
  assert.equal(agents[0].env.FOO, 'bar')
})

test('worker 框架准备失败按执行错误返回，不归咎于 agent', async t => {
  const { state, cfg, runTestDetailed } = await fixture(t)
  state.prepareKind = 'setup'
  state.prepareError = 'MaaFW setup failed'
  const result = await runTestDetailed(cfg)
  assertPublicResult(result)
  assert.equal(result.status, 'error')
  assert.equal(result.errorCode, 'test-execution-failed')
  assert.equal(result.reason, 'MaaFW setup failed')
  assert.equal(state.terminated, 1)
})

test('识别过程中 agent 失联按 agent 执行错误返回', async t => {
  const { state, cfg, runTestDetailed } = await fixture(t)
  state.jobError = 'agent 进程已退出或已失联：node'
  const result = await runTestDetailed(cfg)
  assertPublicResult(result)
  assert.equal(result.status, 'error')
  assert.equal(result.errorCode, 'test-agent-failed')
  assert.equal(result.reason, 'agent 进程已退出或已失联：node')
  assert.equal(state.terminated, 1)
  // 中止后不能把排队任务的空结果记成失败用例
  assert.equal(result.files[0].cases[0].verdict, 'error')
  const platform = result.files[0].cases[0].platforms[0]
  assert.equal(platform?.result.verdict, 'error')
  assert.equal(platform?.result.checks.length, 0)
})

test('worker 准备失败按 agent 执行错误返回，而不是退化成未命中', async t => {
  const { state, cfg, runTestDetailed } = await fixture(t)
  state.prepareError = 'agent 未注册这些 Custom 识别：X（节点 A）'
  const result = await runTestDetailed(cfg)
  assertPublicResult(result)
  assert.equal(result.status, 'error')
  assert.equal(result.errorCode, 'test-agent-failed')
  assert.equal(result.reason, 'agent 未注册这些 Custom 识别：X（节点 A）')
  assert.equal(state.terminated, 1)
})

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
