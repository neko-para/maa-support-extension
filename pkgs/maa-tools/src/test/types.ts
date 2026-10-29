import type { CaseOrigin } from '../types/config'
import type { RunTarget } from './selection'

export type { CaseOrigin } from '../types/config'

export type RecoJob = {
  nodes: string[]
  imagePath: string
  imagePathRaw: string
}

export type RecoResult = {
  imagePath: string
  imagePathRaw: string
  node: string
  hit: boolean
  detail: maa.RecoDetail | null
  pid: number
}

/** 识别任务执行耗时，不含排队等待。 */
export type RecoJobOutcome = {
  results: RecoResult[]
  durationMs: number
}

export type CheckFailureReason =
  | 'missing-detail'
  | 'should-hit'
  | 'should-miss'
  | 'box-mismatch'
  | 'no-result'

export type CaseCheckResult = {
  node: string
  expected: 'hit' | 'miss'
  expectedBox?: maa.Rect
  hit: boolean
  detail: maa.RecoDetail | null
  ok: boolean
  reason?: CheckFailureReason
}

/** skipped 表示缺图，未得到验证。error 表示无法完成验证。 */
export type CaseVerdict = 'pass' | 'fail' | 'skipped' | 'error'

export type TestCaseRunResult = {
  image: string
  imagePath: string
  verdict: CaseVerdict
  checks: CaseCheckResult[]
  /** 复用截图的识别耗时在该组的用例间分摊，避免重复累计。 */
  durationMs: number
  error?: string
  origin: CaseOrigin
}

export type TestGroupRunResult = {
  name: string
  /** configs 中声明的原值，不是截图目录别名。 */
  controller: string
  resource: string
  verdict: CaseVerdict
  cases: TestCaseRunResult[]
  durationMs: number
}

export type ListedCase = {
  index: number
  name: string | null
  image: string
  hits: string[]
  /** 源文件字符范围，0 起，end 为开区间。 */
  start: number
  end: number
}

export type ListedFileBody = {
  name?: string | null
  error?: string
  controllers: string[]
  resources: string[]
  cases: ListedCase[]
}

export type ListedFile = ListedFileBody & {
  /** 规范化绝对路径，显示相对路径由调用方处理。 */
  file: string
}

export type TestCollection = {
  files: ListedFile[]
  errorCode?: string
  reason?: string
}

export type TestFileCaseResult = ListedCase & {
  verdict: CaseVerdict
  durationMs: number
  reason?: string
  platforms: {
    controller: string
    resource: string
    result: TestCaseRunResult
  }[]
}

export type TestFileRunResult = Omit<ListedFile, 'cases'> & {
  /** 计划阶段确定的原始下标，cases 必须完整覆盖。 */
  selectedCases: number[]
  verdict: 'pass' | 'fail' | 'error' | 'skipped'
  reason?: string
  cases: TestFileCaseResult[]
}

export type TestRunStatus = 'passed' | 'failed' | 'error' | 'empty'

/** 用例和文件的进度回调事件。 */
export type TestRunEvent =
  | { type: 'case-started'; origin: CaseOrigin }
  | { type: 'case-result'; origin: CaseOrigin; result: TestRunResult }
  | { type: 'file-result'; file: string; result: TestRunResult }

/** test --jsonl 标准输出中的单条记录。 */
export type TestRunLine = TestRunEvent | { type: 'run-result'; result: TestRunResult }

export type TestRunOptions = {
  targets?: readonly RunTarget[]
  controllers?: readonly string[]
  resources?: readonly string[]
  /** 回调按事件顺序等待；传输失败不改变识别结论，最终结果仍完整返回。 */
  onEvent?: (event: TestRunEvent) => void | Promise<void>
}

export type TestRunResult = {
  status: TestRunStatus
  errorCode?: string
  reason?: string
  files: TestFileRunResult[]
  /** 整次运行的墙钟耗时。 */
  durationMs: number
}
