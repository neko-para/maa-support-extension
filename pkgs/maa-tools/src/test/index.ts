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
import { buildGroupRunResult, evaluateCase, groupNameOf } from './evaluate'
import { TestSourceError } from './filter'
import { createRunLogDir, releaseRunLogDir, testLogRoot } from './log-dir'
import { TestPlanError, expandTestGroups, filesForTargets } from './plan'
import { TestRunProgress } from './progress'
import { compareTestCases, getDefaultTestJobCount, groupResourcePlans } from './schedule'
import type {
  CaseCheckResult,
  ListedFile,
  RecoJob,
  RecoJobOutcome,
  TestCaseRunResult,
  TestRunOptions,
  TestRunResult
} from './types'
import { createRecoJobs, resolveTestImagePath } from './utils'

export { collectTests } from './list'
export type {
  CaseCheckResult,
  CaseOrigin,
  CaseVerdict,
  CheckFailureReason,
  ListedCase,
  ListedFile,
  TestCaseRunResult,
  TestCollection,
  TestFileCaseResult,
  TestFileRunResult,
  TestGroupRunResult,
  TestRunEvent,
  TestRunOptions,
  TestRunResult,
  TestRunStatus
} from './types'

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

  const testConfig = cfg.test
  if (!testConfig) {
    return done('test-config-missing', 'test config missing')
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
              ...(testCase.origin ? { origin: testCase.origin } : {}),
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
      const modulePath = await setupMaa(cfg)
      if (!modulePath) {
        return done(errorCode, 'MaaFW setup failed')
      }
      errorCode = 'resource-bundle-failed'
      const bundle = await loadBundle(cfg)
      if (!bundle) {
        return done(errorCode, 'failed to load resource bundle')
      }
      try {
        for (const plan of activePlans) {
          plan.resourcePaths = bundle
            .resolvePaths(plan.testCases.configs.controller, plan.testCases.configs.resource)
            .map(folder => joinPath(bundle.root, folder))
        }
      } finally {
        bundle.stop()
      }

      errorCode = 'test-execution-failed'
      const runLogDir = await createRunLogDir(testLogRoot(cfg), testConfig.maaLogKeep)
      let finished = 0
      try {
        for (const [poolIndex, group] of groupResourcePlans(activePlans).entries()) {
          const pool = workerpool.pool(path.join(import.meta.dirname, 'test', 'worker.mjs'), {
            maxWorkers: testConfig.job ?? getDefaultTestJobCount(os.cpus().length),
            workerType: 'process',
            forkOpts: {
              env: {
                MAAFW_MODULE_PATH: modulePath,
                MAAFW_STDOUT_LEVEL: cfg.mode === 'json' ? 'Off' : cfg.maaStdoutLevel,
                MAAFW_LOG_DIR: runLogDir,
                MAAFW_RESOURCE_PATHS: group[0].resourcePaths.join(path.delimiter),
                MAATOOLS_POOL_ID: String(poolIndex)
              }
            }
          })
          try {
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
                      const outcome = await pool
                        .exec<(job: RecoJob) => RecoJobOutcome>('performReco', [job])
                        .catch(error => {
                          console.error(error)
                          return { results: [], durationMs: 0 } satisfies RecoJobOutcome
                        })
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
            await pool.terminate()
          }
        }
      } finally {
        await releaseRunLogDir(runLogDir)
      }
    }
    return done()
  } catch (error) {
    if (error instanceof TestSourceError || error instanceof TestPlanError) {
      files = error.files ?? files
      errorCode = error.errorCode
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
