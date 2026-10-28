import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { setLocale } from '@nekosu/maa-locale'

import pkg from '../package.json'
import { runCheck } from './check'
import { type TestCliOptions, USAGE, parseCliArgs } from './cli-args'
import { collectTests, runTest, runTestDetailed } from './test'
import { buildTestRunResult } from './test/report'
import { buildRunTargets } from './test/targets'
import type { ListedFile, TestRunResult } from './test/types'
import type { FullConfig } from './types/config'
import { loadConfig } from './utils/config'
import { captureTestFileReads } from './utils/tools'

const defaultConfig = `import type { FullConfig } from '${pkg.name}'

const config: FullConfig = {
  cwd: import.meta.dirname,
  maaVersion: 'latest',
  interfacePath: 'assets/interface.json',
  check: {},
}

export default config
`

export { parseCliArgs } from './cli-args'
export type { CliInvocation, TestCliOptions } from './cli-args'

// 保存原始出口；配置和 loader 执行期间，JavaScript 对 stdout.write 的调用统一转到 stderr。
const writeStdout = process.stdout.write.bind(process.stdout)

function errorResult(
  errorCode: string,
  reason: string,
  startedAt: number,
  files: readonly ListedFile[] = []
): TestRunResult {
  return buildTestRunResult({
    groups: [],
    files,
    durationMs: performance.now() - startedAt,
    errorCode,
    reason
  })
}

function errorFiles(error: unknown): ListedFile[] {
  return typeof error === 'object' &&
    error !== null &&
    'files' in error &&
    Array.isArray(error.files)
    ? error.files
    : []
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function errorCodeOf(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'errorCode' in error) {
    const code = error.errorCode
    if (typeof code === 'string' && code.length > 0) {
      return code
    }
  }
  return fallback
}

/** bin 入口：参数错误和未处理异常也按所选格式输出，退出码由 bin 设置。 */
export async function runCliFromArgs(argv: readonly string[]): Promise<number> {
  const startedAt = performance.now()
  const jsonl = argv.includes('--jsonl')
  let reason = ''
  const invocation = parseCliArgs(argv, message => {
    reason = message
    console.error(message)
  })
  if (!invocation) {
    if (jsonl || argv.includes('--json')) {
      const result = errorResult('invalid-cli-arguments', reason, startedAt)
      await emitJson(jsonl ? { schemaVersion: 1, type: 'run-result', result } : result)
    }
    return 2
  }
  try {
    return (await runCli(invocation.cmd, invocation.config, invocation.options)) ? 0 : 1
  } catch (error) {
    console.error(error)
    if (invocation.cmd === 'test' && (jsonl || invocation.options.json)) {
      const result = errorResult(errorCodeOf(error, 'cli-failed'), describeError(error), startedAt)
      await emitJson(jsonl ? { schemaVersion: 1, type: 'run-result', result } : result)
    }
    return 1
  }
}

export async function runCli(cmd: string, cfg: string | FullConfig, options: TestCliOptions = {}) {
  if (cmd === 'version') {
    console.log(pkg.version)
    return true
  }
  if (cmd === 'init') {
    if (!existsSync('maatools.config.mts')) {
      await fs.writeFile('maatools.config.mts', defaultConfig)
    } else {
      console.error('maatools.config.mts exists')
    }
    return true
  }
  if (cmd !== 'test' && cmd !== 'check') {
    console.log(USAGE)
    return false
  }

  if (cmd === 'test') {
    const dispatch = () => captureTestFileReads(() => runConfiguredTest(cfg, options))
    // 先重定向配置和 loader 日志；列表与机器结果使用保存的 stdout 出口。
    if (options.json || options.jsonl || options.list) {
      return (await withLogsToStderr(dispatch)).value
    }
    return (await dispatch()).value
  }

  const resolved = await resolveConfig(cfg)
  return resolved ? await runCheck(resolved) : false
}

async function resolveConfig(cfg: string | FullConfig): Promise<FullConfig | null> {
  if (typeof cfg === 'string') {
    const resolved = await loadConfig(cfg)
    if (!resolved) {
      console.error(`load ${cfg} failed`)
      return null
    }
    cfg = resolved
  }
  if (typeof cfg !== 'object' || cfg === null || Array.isArray(cfg)) {
    throw Object.assign(new Error('配置文件必须导出配置对象'), { errorCode: 'invalid-config' })
  }
  if (process.env['GITHUB_ACTIONS'] && !cfg.mode) {
    cfg.mode = 'github'
  }
  if (cfg.locale) {
    setLocale(cfg.locale)
  }
  return cfg
}

async function runConfiguredTest(
  cfg: string | FullConfig,
  options: TestCliOptions
): Promise<boolean> {
  const startedAt = performance.now()
  const machine = options.json || options.jsonl
  let stage = 'config-load-failed'
  try {
    if (options.jsonl && (options.json || options.list)) {
      throw Object.assign(new Error('--jsonl 不能和 --json 或 --list 一起用'), {
        errorCode: 'invalid-cli-arguments'
      })
    }
    if (options.list && options.caseIndices?.length) {
      throw Object.assign(new Error('--list 不支持 --case；请在运行时选择用例'), {
        errorCode: 'invalid-cli-arguments'
      })
    }
    const resolved = await resolveConfig(cfg)
    if (!resolved) {
      throw Object.assign(new Error(`无法加载配置：${String(cfg)}`), {
        errorCode: 'config-load-failed'
      })
    }
    const selection = { controllers: options.controllers, resources: options.resources }
    const files = (options.files ?? []).map(file => path.resolve(process.cwd(), file))
    if (options.list) {
      stage = 'test-collection-failed'
      const collection = await collectTests(resolved, files, selection)
      if (options.json) {
        await emitJson(
          collection.errorCode
            ? {
                ...collection,
                status: 'error',
                groups: [],
                durationMs: performance.now() - startedAt
              }
            : collection
        )
      } else {
        const lines: string[] = []
        let caseCount = 0
        let errorCount = 0
        for (const file of collection.files) {
          lines.push(path.relative(process.cwd(), file.file) || file.file)
          if (file.error) {
            lines.push(`  错误：${file.error}`)
            errorCount += 1
          }
          for (const testCase of file.cases) {
            lines.push(
              `  [${testCase.index}] ${testCase.name ? `${testCase.name} (${testCase.image})` : testCase.image}`
            )
            caseCount += 1
          }
        }
        if (collection.files.length === 0) {
          lines.push('没有收集到测试文件或用例。')
        }
        lines.push(
          `共 ${collection.files.length} 个文件，${caseCount} 条用例${errorCount ? `，${errorCount} 个文件有错误` : ''}。`
        )
        await new Promise<void>((resolve, reject) => {
          writeStdout(`${lines.join('\n')}\n`, error => (error ? reject(error) : resolve()))
        })
        if (collection.errorCode) {
          console.error(`收集失败：${collection.reason ?? collection.errorCode}`)
        }
      }
      return !collection.errorCode
    }
    if (machine) {
      resolved.mode = 'json'
    }
    stage = 'target-selection-failed'
    const targets = await buildRunTargets(
      files,
      options.caseIndices?.length ? options.caseIndices : undefined
    )
    const runOptions = { targets, ...selection, onEvent: options.jsonl ? emitJson : undefined }
    stage = 'test-execution-failed'
    if (options.json || options.jsonl) {
      const result = await runTestDetailed(resolved, runOptions)
      await emitJson(options.jsonl ? { schemaVersion: 1, type: 'run-result', result } : result)
      return result.status === 'passed'
    }
    return await runTest(resolved, runOptions)
  } catch (error) {
    console.error(error)
    if (machine) {
      const result = errorResult(
        errorCodeOf(error, stage),
        describeError(error),
        startedAt,
        errorFiles(error)
      )
      await emitJson(options.jsonl ? { schemaVersion: 1, type: 'run-result', result } : result)
    }
    return false
  }
}

/** 每次只写一个紧凑 JSON 行；等待标准流写入回调，不另建发送队列。 */
function emitJson(payload: object): Promise<void> {
  return new Promise((resolve, reject) => {
    writeStdout(`${JSON.stringify(payload)}\n`, error => (error ? reject(error) : resolve()))
  })
}

/** console 的各类输出和直接 stdout.write 都走 stderr；不接管原生模块直接写文件描述符。 */
async function withLogsToStderr<T>(run: () => Promise<T>): Promise<T> {
  const original = process.stdout.write
  process.stdout.write = process.stderr.write.bind(process.stderr) as typeof process.stdout.write
  try {
    return await run()
  } finally {
    process.stdout.write = original
  }
}
