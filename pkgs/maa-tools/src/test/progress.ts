import * as path from 'node:path'

import type { CaseOrigin, TestCases } from '../types/config'
import { buildGroupRunResult, evaluateCase } from './evaluate.ts'
import { buildTestRunResult } from './report.ts'
import type {
  ListedFile,
  RecoJob,
  RecoJobOutcome,
  TestCaseRunResult,
  TestRunEvent,
  TestRunOptions,
  TestRunResult
} from './types'
import { distributeImageDurations } from './utils.ts'

function originKey(origin: CaseOrigin) {
  return JSON.stringify([path.resolve(origin.file), origin.case])
}

type OriginState = {
  origin: CaseOrigin
  pending: number
  started: boolean
  completed: boolean
}

type FileState = {
  metadata: ListedFile
  remaining: number
  emitted: boolean
}

/** 按实际计划槽位记录结果；同一原始用例的全部平台结束后才能发布结论。 */
export class TestRunProgress {
  plannedGroups: readonly TestCases[]
  files = new Map<string, FileState>()
  origins = new Map<string, OriginState>()
  results: (TestCaseRunResult | undefined)[][]
  onEvent: TestRunOptions['onEvent']
  elapsed: () => number
  queue: Promise<void> = Promise.resolve()
  failure?: { errorCode: string; reason?: string }
  finished?: TestRunResult

  constructor(options: {
    plannedGroups: readonly TestCases[]
    files: readonly ListedFile[]
    onEvent?: TestRunOptions['onEvent']
    elapsed: () => number
  }) {
    this.plannedGroups = options.plannedGroups
    this.onEvent = options.onEvent
    this.elapsed = options.elapsed
    this.results = options.plannedGroups.map(group => group.cases.map(() => undefined))
    for (const file of options.files) {
      const absolute = path.resolve(file.file)
      const metadata = {
        ...file,
        file: absolute,
        cases: [...file.cases].sort((left, right) => left.index - right.index)
      }
      this.files.set(absolute, { metadata, remaining: metadata.cases.length, emitted: false })
      for (const testCase of metadata.cases) {
        const origin = { file: absolute, case: testCase.index }
        this.origins.set(originKey(origin), {
          origin,
          pending: 0,
          started: false,
          completed: false
        })
      }
    }
    for (const group of options.plannedGroups) {
      for (const testCase of group.cases) {
        const state = testCase.origin ? this.origins.get(originKey(testCase.origin)) : undefined
        if (state) {
          state.pending += 1
        }
      }
    }
  }

  enqueue<T>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(run)
    this.queue = next.then(
      () => {},
      () => {}
    )
    return next
  }

  async emit(event: TestRunEvent) {
    try {
      await this.onEvent?.(structuredClone(event))
    } catch (error) {
      this.onEvent = undefined
      console.error(
        'Test progress callback failed; remaining results will be returned at the end.',
        error
      )
    }
  }

  groupResults(accept: (result: TestCaseRunResult) => boolean = () => true) {
    return this.plannedGroups.flatMap((group, groupIndex) => {
      const cases = this.results[groupIndex].filter(
        (result): result is TestCaseRunResult => result !== undefined && accept(result)
      )
      return cases.length > 0 ? [buildGroupRunResult(group, cases)] : []
    })
  }

  snapshot(file: ListedFile, caseIndex?: number): TestRunResult {
    const cases = file.cases.filter(item => caseIndex === undefined || item.index === caseIndex)
    return buildTestRunResult({
      files: [{ ...file, cases }],
      groups: this.groupResults(
        result =>
          result.origin !== undefined &&
          path.resolve(result.origin.file) === file.file &&
          (caseIndex === undefined || result.origin.case === caseIndex)
      ),
      plannedGroups: this.plannedGroups,
      durationMs: this.elapsed(),
      ...this.failure
    })
  }

  async completeFile(file: FileState) {
    if (file.emitted || file.remaining > 0) {
      return
    }
    file.emitted = true
    if (this.onEvent) {
      await this.emit({
        schemaVersion: 1,
        type: 'file-result',
        file: file.metadata.file,
        result: this.snapshot(file.metadata)
      })
    }
  }

  async completeOrigin(state: OriginState) {
    if (state.completed || state.pending > 0) {
      return
    }
    state.completed = true
    const file = this.files.get(state.origin.file)!
    file.remaining -= 1
    if (this.onEvent) {
      await this.emit({
        schemaVersion: 1,
        type: 'case-result',
        origin: state.origin,
        result: this.snapshot(file.metadata, state.origin.case)
      })
    }
    await this.completeFile(file)
  }

  /** 无实际计划的所选用例、坏文件和空文件已有确定结论，无需等待识别。 */
  initialize() {
    return this.enqueue(async () => {
      for (const state of this.origins.values()) {
        await this.completeOrigin(state)
      }
      for (const state of this.files.values()) {
        await this.completeFile(state)
      }
    })
  }

  startCase(origin: CaseOrigin | undefined) {
    return this.enqueue(async () => {
      const state = origin ? this.origins.get(originKey(origin)) : undefined
      if (!state || state.started || state.completed || !this.onEvent) {
        return
      }
      state.started = true
      await this.emit({ schemaVersion: 1, type: 'case-started', origin: state.origin })
    })
  }

  async storeCase(groupIndex: number, caseIndex: number, result: TestCaseRunResult) {
    if (this.results[groupIndex][caseIndex] !== undefined) {
      throw new Error('A test case result was recorded more than once')
    }
    this.results[groupIndex][caseIndex] = result
    const planned = this.plannedGroups[groupIndex].cases[caseIndex]
    const state = planned.origin ? this.origins.get(originKey(planned.origin)) : undefined
    if (state) {
      state.pending -= 1
      await this.completeOrigin(state)
    }
  }

  recordCase(groupIndex: number, caseIndex: number, result: TestCaseRunResult) {
    return this.enqueue(async () => {
      if (this.finished) {
        throw new Error('Cannot record test results after the run has finished')
      }
      await this.storeCase(groupIndex, caseIndex, result)
    })
  }

  /** 一张图的全部节点块结束后即判定，不等待同组的其它图片。 */
  async runImage(
    groupIndex: number,
    caseIndexes: readonly number[],
    jobs: readonly RecoJob[],
    runJob: (job: RecoJob) => Promise<RecoJobOutcome>
  ) {
    const group = this.plannedGroups[groupIndex]
    for (const index of caseIndexes) {
      await this.startCase(group.cases[index].origin)
    }
    const outcomes = await Promise.all(jobs.map(runJob))
    const imagePath = jobs[0].imagePath
    const results = outcomes.flatMap(outcome => outcome.results)
    const duration = outcomes.reduce((sum, outcome) => sum + outcome.durationMs, 0)
    const durations = distributeImageDurations(
      caseIndexes.map(() => imagePath),
      new Map([[imagePath, duration]])
    )
    const cases: TestCaseRunResult[] = []
    for (const [position, caseIndex] of caseIndexes.entries()) {
      const result = evaluateCase(group.cases[caseIndex], imagePath, results, group.nodes ?? [])
      result.durationMs = durations[position]
      cases.push(result)
      await this.recordCase(groupIndex, caseIndex, result)
    }
    return cases
  }

  finish(errorCode?: string, reason?: string) {
    return this.enqueue(async () => {
      if (this.finished) {
        return this.finished
      }
      if (errorCode) {
        this.failure = { errorCode, reason }
      }
      for (const [groupIndex, group] of this.plannedGroups.entries()) {
        for (const [caseIndex, testCase] of group.cases.entries()) {
          if (this.results[groupIndex][caseIndex] !== undefined) {
            continue
          }
          await this.storeCase(groupIndex, caseIndex, {
            image: testCase.image,
            imagePath: '',
            ...(testCase.origin ? { origin: testCase.origin } : {}),
            verdict: 'error',
            checks: [],
            durationMs: 0,
            error: reason ?? errorCode ?? 'no-result'
          })
        }
      }
      for (const state of this.origins.values()) {
        await this.completeOrigin(state)
      }
      for (const file of this.files.values()) {
        await this.completeFile(file)
      }
      this.finished = buildTestRunResult({
        files: [...this.files.values()].map(file => file.metadata),
        groups: this.groupResults(),
        plannedGroups: this.plannedGroups,
        durationMs: this.elapsed(),
        ...this.failure
      })
      return this.finished
    })
  }
}
