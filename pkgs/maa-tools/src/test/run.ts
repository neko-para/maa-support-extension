import { info as coreInfo, warning as coreWarning } from '@actions/core'
import chalk from 'chalk'
import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as workerpool from 'workerpool'

import { joinPath } from '@nekosu/maa-pipeline-manager'

import type { FullConfig, TestCases } from '../types/config'
import { loadBundle } from '../utils/bundle'
import { setupMaa } from '../utils/maa'
import {
  AGENTS_ENV,
  type AgentDeclaration,
  PLANNED_NODES_ENV,
  type ResolvedAgentConfig,
  buildTestAgentEnv,
  resolveTestAgents
} from './agents'
import { buildGroupRunResult, evaluateCase, groupNameOf } from './evaluate'
import { createRecoJobs, resolveTestImagePath } from './images'
import { createRunLogDir, releaseRunLogDir, testLogRoot } from './log-dir'
import { TestPlanError, expandTestGroups } from './plan'
import { TestRunProgress } from './progress'
import { buildTestRunResult } from './report'
import { filesForTargets } from './selection'
import type {
  CaseCheckResult,
  ListedFile,
  PrepareOutcome,
  RecoJob,
  RecoJobOutcome,
  TestCaseRunResult,
  TestRunOptions,
  TestRunResult
} from './types'

type ResourcePlan = {
  resourcePaths: readonly string[]
}

/** 运行环境（agent 等）错误：整批按 error 处理，不能退化成识别未命中。 */
class TestRunFailure extends Error {
  constructor(
    readonly errorCode: string,
    message: string
  ) {
    super(message)
  }
}

/** 父侧 watchdog：native 调用可能永久阻塞（agent 挂死），必须有兜底。 */
const DEFAULT_AGENT_JOB_TIMEOUT_MS = 60_000
const MIN_EXPLICIT_AGENT_JOB_TIMEOUT_MS = 1_000
/** 准备工作含 worker 启动与资源加载，超时只防挂死，不参与识别排队。 */
const PREPARE_WATCHDOG_MS = 120_000

/**
 * force terminate 会直接杀掉 worker，命中 onTerminate 的机会消失；worker 在启动 agent 时
 * 增量写 pid 文件，这里按文件回收残留的 agent 进程。只覆盖直接子进程，孙进程不处理；
 * pid 理论上可能被系统复用，属已知低概率风险。
 */
async function cleanupOrphanAgents(logDir: string) {
  let files: string[]
  try {
    files = await fs.readdir(logDir)
  } catch {
    return
  }
  for (const file of files) {
    if (!file.startsWith('agent-pids-') || !file.endsWith('.json')) {
      continue
    }
    const full = path.join(logDir, file)
    try {
      const pids = JSON.parse(await fs.readFile(full, 'utf8')) as unknown
      if (Array.isArray(pids)) {
        for (const pid of pids) {
          if (typeof pid === 'number' && Number.isSafeInteger(pid)) {
            try {
              process.kill(pid)
            } catch {
              // 进程已退出时忽略。
            }
          }
        }
      }
    } catch {
      // 文件损坏时只删除。
    }
    await fs.rm(full, { force: true }).catch(() => {})
  }
}

function agentJobTimeoutMs(configs: readonly ResolvedAgentConfig[]) {
  let explicit = 0
  for (const config of configs) {
    if (config.timeoutMs > 0) {
      explicit = Math.max(explicit, config.timeoutMs)
    }
  }
  return explicit > 0
    ? Math.max(MIN_EXPLICIT_AGENT_JOB_TIMEOUT_MS, explicit)
    : DEFAULT_AGENT_JOB_TIMEOUT_MS
}

/** workerpool 的 promise.timeout 拒绝值是 name 为 TimeoutError 的 Error。 */
function isWorkerpoolTimeout(error: unknown) {
  return error instanceof Error && error.name === 'TimeoutError'
}

export function getDefaultTestJobCount(cpuCount: number) {
  return Math.max(1, Math.floor(cpuCount / 4))
}

export function compareTestCases(left: TestCases, right: TestCases) {
  const controllerOrder = left.configs.controller.localeCompare(right.configs.controller)
  if (controllerOrder !== 0) {
    return controllerOrder
  }
  return left.configs.resource.localeCompare(right.configs.resource)
}

export function groupResourcePlans<T extends ResourcePlan>(plans: readonly T[]) {
  const groups = new Map<string, T[]>()
  for (const plan of plans) {
    const key = JSON.stringify(plan.resourcePaths)
    const group = groups.get(key)
    if (group) {
      group.push(plan)
    } else {
      groups.set(key, [plan])
    }
  }
  return [...groups.values()]
}

type GroupRunPlan = {
  groupIndex: number
  testCases: TestCases
  caseImages: { image: string; imagePath: string; exists: boolean }[]
  nodes: string[]
  jobs: RecoJob[]
  resourcePaths: string[]
}

/** 运行、逐用例判定和逐文件汇总共用一份结果。 */
export async function runTestDetailed(
  cfg: FullConfig,
  options: TestRunOptions = {}
): Promise<TestRunResult> {
  const startedAt = performance.now()
  let files: ListedFile[] = filesForTargets(options.targets ?? [])
  let plannedGroups: TestCases[] = []
  let progress: TestRunProgress | undefined
  const createProgress = () =>
    new TestRunProgress({
      files,
      plannedGroups,
      onEvent: options.onEvent,
      elapsed: () => performance.now() - startedAt
    })
  const done = (errorCode?: string, reason?: string) => {
    progress ??= createProgress()
    return progress.finish(errorCode, reason)
  }
  // 运行环境错误会中止整批；中止后要拦住仍在排队的任务，避免它们被当成
  // "正常空结果"记成失败，或把进度报成 100%。
  let abortError: TestRunFailure | undefined = undefined
  const fail = (errorCode: string, message: string): never => {
    abortError = new TestRunFailure(errorCode, message)
    throw abortError
  }

  const testConfig = cfg.test
  if (!testConfig) {
    return done('test-config-missing', 'test config missing')
  }
  const configuredJobs = testConfig.job
  if (
    configuredJobs !== undefined &&
    (!Number.isSafeInteger(configuredJobs) || configuredJobs < 1)
  ) {
    return done('invalid-test-config', 'test.job 必须是大于等于 1 的安全整数')
  }

  const putLog = (log: string) => {
    if (cfg.mode === 'github') {
      coreInfo(log)
    } else if (cfg.mode === 'json') {
      console.error(log)
    } else {
      console.log(log)
    }
  }
  const printedGroups = new Set<number>()
  const logCase = (plan: GroupRunPlan, result: TestCaseRunResult) => {
    const failedChecks = result.checks.filter(check => !check.ok)
    if (failedChecks.length === 0 && !result.error) {
      return
    }
    if (!printedGroups.has(plan.groupIndex)) {
      putLog(chalk.red(groupNameOf(plan.testCases)))
      printedGroups.add(plan.groupIndex)
    }
    for (const check of failedChecks) {
      putLog(formatCheckError(result.image, check))
    }
    if (result.error && failedChecks.length === 0) {
      putLog(`  ${result.image} ${result.error}.`)
    }
  }
  const logGroup = (plan: GroupRunPlan) => {
    if (printedGroups.has(plan.groupIndex)) {
      return
    }
    const cases = progress!.results[plan.groupIndex].filter(
      (result): result is TestCaseRunResult => result !== undefined
    )
    const group = buildGroupRunResult(plan.testCases, cases)
    const color =
      group.verdict === 'pass'
        ? chalk.green
        : group.verdict === 'skipped'
          ? chalk.yellow
          : chalk.red
    putLog(color(group.name))
  }

  let errorCode = 'test-expansion-failed'
  try {
    const expanded = await expandTestGroups(cfg, options)
    files = expanded.files
    plannedGroups = [...expanded.groups].sort(compareTestCases)
    progress = createProgress()
    await progress.initialize()
    if (plannedGroups.length === 0) {
      return done()
    }

    const maxNodePerJob = testConfig.maxNodePerJob ?? 50
    const plans: GroupRunPlan[] = plannedGroups.map((testCases, groupIndex) => {
      const name = groupNameOf(testCases)
      const caseImages = testCases.cases.map(testCase => {
        const imagePath = resolveTestImagePath(cfg, testCases, testCase.image)
        return { image: testCase.image, imagePath, exists: existsSync(imagePath) }
      })
      for (const image of caseImages) {
        if (image.exists) {
          continue
        }
        const warning = `${name} ${image.image} not exists, ignored`
        if (cfg.mode === 'github') {
          coreWarning(warning)
        } else {
          putLog(warning)
        }
      }
      const nodes = testCases.nodes ?? []
      return {
        groupIndex,
        testCases,
        caseImages,
        nodes,
        jobs: createRecoJobs(
          caseImages.filter(image => image.exists),
          nodes,
          maxNodePerJob
        ),
        resourcePaths: []
      }
    })

    for (const plan of plans) {
      for (const [caseIndex, testCase] of plan.testCases.cases.entries()) {
        const image = plan.caseImages[caseIndex]
        if (image.exists && plan.nodes.length > 0) {
          continue
        }
        const result: TestCaseRunResult = image.exists
          ? evaluateCase(testCase, image.imagePath, [], plan.nodes)
          : {
              image: testCase.image,
              imagePath: image.imagePath,
              origin: testCase.origin,
              verdict: 'skipped',
              checks: [],
              durationMs: 0
            }
        logCase(plan, result)
        await progress.recordCase(plan.groupIndex, caseIndex, result)
      }
      if (plan.jobs.length === 0) {
        logGroup(plan)
      }
    }

    const activePlans = plans.filter(plan => plan.jobs.length > 0)
    const taskCount = activePlans.reduce(
      (total, plan) => total + plan.jobs.reduce((count, job) => count + job.nodes.length, 0),
      0
    )
    if (activePlans.length > 0) {
      errorCode = 'maa-setup-failed'
      const maaSetup = await setupMaa(cfg)
      if (!maaSetup) {
        return done(errorCode, 'MaaFW setup failed')
      }
      errorCode = 'resource-bundle-failed'
      const bundle = await loadBundle(cfg)
      if (!bundle) {
        return done(errorCode, 'failed to load resource bundle')
      }
      let agentConfigs: ResolvedAgentConfig[] = []
      try {
        for (const plan of activePlans) {
          plan.resourcePaths = bundle
            .resolvePaths(plan.testCases.configs.controller, plan.testCases.configs.resource)
            .map(folder => joinPath(bundle.root, folder))
        }

        const interfaceObject = bundle.content?.object
        const interfaceAgents: AgentDeclaration[] = interfaceObject?.agent
          ? Array.isArray(interfaceObject.agent)
            ? interfaceObject.agent
            : [interfaceObject.agent]
          : []
        const resolvedAgents = resolveTestAgents({
          setting: testConfig.agent,
          interfaceAgents,
          interfaceRoot: bundle.root,
          cwd: cfg.cwd ?? process.cwd(),
          baseEnv: buildTestAgentEnv({
            locale: cfg.locale,
            maafwVersion: maaSetup.version,
            interfaceVersion: interfaceObject?.version
          })
        })
        if (resolvedAgents.error) {
          fail('test-agent-invalid', resolvedAgents.error)
        }
        agentConfigs = resolvedAgents.agents
      } finally {
        bundle.stop()
      }

      const recognitionTimeoutMs = agentJobTimeoutMs(agentConfigs)
      errorCode = 'test-execution-failed'
      const runLogDir = await createRunLogDir(testLogRoot(cfg), testConfig.maaLogKeep)
      putLog(`MaaFW log directory: ${runLogDir}`)
      let finished = 0
      try {
        for (const [poolIndex, group] of groupResourcePlans(activePlans).entries()) {
          const pool = workerpool.pool(path.join(import.meta.dirname, 'test', 'worker.mjs'), {
            maxWorkers: configuredJobs ?? getDefaultTestJobCount(os.cpus().length),
            workerType: 'process',
            forkOpts: {
              env: {
                ...process.env,
                MAAFW_MODULE_PATH: maaSetup.modulePath,
                MAAFW_STDOUT_LEVEL: cfg.mode === 'json' ? 'Off' : cfg.maaStdoutLevel,
                MAAFW_LOG_DIR: runLogDir,
                MAAFW_RESOURCE_PATHS: group[0].resourcePaths.join(path.delimiter),
                MAATOOLS_POOL_ID: String(poolIndex),
                [AGENTS_ENV]: JSON.stringify(agentConfigs),
                [PLANNED_NODES_ENV]: JSON.stringify([...new Set(group.flatMap(plan => plan.nodes))])
              }
            }
          })
          try {
            const prepared = await pool
              .exec<() => Promise<PrepareOutcome>>('prepare', [])
              .timeout(PREPARE_WATCHDOG_MS)
              .catch((error): PrepareOutcome => {
                if (isWorkerpoolTimeout(error)) {
                  fail('test-execution-failed', `worker 准备超时（${PREPARE_WATCHDOG_MS}ms）`)
                }
                const message = error instanceof Error ? error.message : String(error)
                console.error(error)
                return {
                  ok: false,
                  kind: 'setup',
                  error: /not found|Unknown method/i.test(message)
                    ? `worker 未实现 prepare，maa-tools 与 worker 版本不一致：${message}`
                    : message
                }
              })
            if (!prepared || !prepared.ok) {
              fail(
                prepared?.kind === 'agent' ? 'test-agent-failed' : 'test-execution-failed',
                prepared?.error ?? 'worker 未返回准备结果（maa-tools 与 worker 版本不一致？）'
              )
            }
            // 没有真的启动 agent 时不启用识别 watchdog：纯 pipeline 套件恢复旧行为。
            const jobTimeoutMs = prepared.ok && prepared.agentsStarted ? recognitionTimeoutMs : 0
            for (const plan of group) {
              const jobsByImage = new Map<string, RecoJob[]>()
              for (const job of plan.jobs) {
                const jobs = jobsByImage.get(job.imagePath) ?? []
                jobs.push(job)
                jobsByImage.set(job.imagePath, jobs)
              }
              await Promise.all(
                [...jobsByImage].map(async ([imagePath, jobs]) => {
                  const caseIndexes = plan.caseImages.flatMap((image, index) =>
                    image.imagePath === imagePath ? [index] : []
                  )
                  const cases = await progress!.runImage(
                    plan.groupIndex,
                    caseIndexes,
                    jobs,
                    async job => {
                      const exec = pool.exec<(job: RecoJob) => RecoJobOutcome>('performReco', [job])
                      // promise.timeout 从任务真正开始执行时计时，排队等待不计入。
                      const watched = jobTimeoutMs > 0 ? exec.timeout(jobTimeoutMs) : exec
                      const outcome = await watched.catch((error): never => {
                        // 中止时排队任务会被 pool 拒绝，不能记成空结果。
                        if (abortError) {
                          throw abortError
                        }
                        if (isWorkerpoolTimeout(error)) {
                          fail(
                            'test-agent-failed',
                            `节点识别（${job.nodes.join(', ')}）超时（${jobTimeoutMs}ms），agent 无响应`
                          )
                        }
                        // worker 崩溃/池拒绝等异常不能退化成用例失败。
                        abortError ??= new TestRunFailure(
                          'test-execution-failed',
                          `worker 执行失败：${error instanceof Error ? error.message : String(error)}`
                        )
                        throw abortError
                      })
                      if (abortError) {
                        throw abortError
                      }
                      if (outcome.error) {
                        fail(
                          outcome.errorKind === 'setup'
                            ? 'test-execution-failed'
                            : 'test-agent-failed',
                          outcome.error
                        )
                      }
                      finished += job.nodes.length
                      process.stderr.write(
                        `${((finished * 100) / taskCount).toFixed(2)}% ${finished} / ${taskCount}\r`
                      )
                      return outcome
                    }
                  )
                  for (const result of cases) {
                    logCase(plan, result)
                  }
                })
              )
              logGroup(plan)
            }
          } finally {
            // 一律 force：非 agent 错误（如 stdout EPIPE）时 abortError 也可能为空，
            // 非 force 的 terminate 会等在途 native 调用而挂死。
            try {
              await pool.terminate(true)
            } catch (error) {
              console.error(error)
            }
            try {
              await cleanupOrphanAgents(runLogDir)
            } catch (error) {
              console.error(error)
            }
          }
        }
      } finally {
        await releaseRunLogDir(runLogDir)
      }
    }
    return done()
  } catch (error) {
    if (error instanceof TestRunFailure) {
      return done(error.errorCode, error.message)
    }
    if (error instanceof TestPlanError) {
      return buildTestRunResult({
        files: error.files ?? files,
        groups: [],
        durationMs: performance.now() - startedAt,
        errorCode: error.errorCode,
        reason: error.message
      })
    }
    return done(errorCode, error instanceof Error ? error.message : String(error))
  }
}

/** 命令行的人类输出入口；失败文件保存同一份完整结果，不再另算失败数组。 */
export async function runTest(cfg: FullConfig, options: TestRunOptions = {}) {
  const result = await runTestDetailed(cfg, options)
  if ((result.status === 'failed' || result.status === 'error') && cfg.test) {
    const file = path.resolve(
      cfg.cwd ?? process.cwd(),
      cfg.test.errorDetailsPath ?? 'maatoolsErrorDetails.json'
    )
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify(result, null, 2))
  }
  if (result.reason) {
    console.error(result.reason)
  }
  return result.status === 'passed'
}

function formatCheckError(image: string, check: CaseCheckResult): string {
  switch (check.reason) {
    case 'missing-detail':
      return `  ${image} ${check.node} missing detail.`
    case 'should-hit':
      return `  ${image} ${check.node} should hit but missed`
    case 'should-miss':
      return `  ${image} ${check.node} should missed but hit`
    case 'box-mismatch':
      return `  ${image} ${check.node} box mismatch. Expect ${JSON.stringify(check.expectedBox)}, hit ${JSON.stringify(check.detail?.box)}`
    case 'no-result':
      return `  ${image} ${check.node} no reco result.`
    default:
      return `  ${image} ${check.node} failed.`
  }
}
