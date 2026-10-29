import * as path from 'node:path'

/** `maa-tools test` 的可选参数。 */
export type TestCliOptions = {
  /** --file：只跑这些测试文件（可重复；相对命令调用目录解析）。 */
  files?: string[]
  /** --case：原始用例下标（0 起，可重复）；只能和单个 --file 一起用。 */
  caseIndices?: number[]
  /** --json：stdout 输出测试结果 JSON，和 --list 一起用时输出收集清单 JSON。 */
  json?: boolean
  /** --jsonl：stdout 逐行输出进度事件，最后一行为 run-result，日志走 stderr。 */
  jsonl?: boolean
  /** --list：只收集用例，默认输出人类列表；加 --json 输出清单 JSON，不初始化 MaaFW。 */
  list?: boolean
  /** --controller：只跑这些 controller 的组（可重复）。 */
  controllers?: string[]
  /** --resource：只跑这些 resource 的组（可重复）。 */
  resources?: string[]
}

export type CliInvocation = {
  cmd: string
  config: string
  options: TestCliOptions
}

export const USAGE = [
  'Usage: npx @nekosu/maa-tools <init|check|test> [path to maatools.config.mts]',
  'test 可选参数（过滤可叠加，取交集）：',
  '  --file <path>       只跑指定测试文件（可重复）',
  '  --case <n>          只跑第 n 条用例（0 起，可重复；只能和单个 --file 一起用）',
  '  --controller <name> 只跑指定 controller 的组（可重复）',
  '  --resource <name>   只跑指定 resource 的组（可重复）',
  '  --json              输出测试结果 JSON；和 --list 一起用时输出收集清单 JSON',
  '  --jsonl             stdout 逐行输出进度 JSON，最后一行为 run-result，日志走 stderr',
  '  --list              只收集用例，默认输出人类列表；可加 --json，不初始化 MaaFW',
  '  --version           打印版本号'
].join('\n')

/** 解析参数；出错时调用 reportError 并返回 null，机器错误 JSON 由命令入口统一输出。 */
export function parseCliArgs(
  argv: readonly string[],
  reportError: (message: string) => void = console.error
): CliInvocation | null {
  const options: TestCliOptions = {
    files: [],
    caseIndices: [],
    json: false,
    jsonl: false,
    list: false,
    controllers: [],
    resources: []
  }
  const positional: string[] = []
  const fail = (reason: string): null => {
    reportError(reason)
    return null
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--file' || arg === '--controller' || arg === '--resource') {
      const value = argv[++i]
      if (!value || value.startsWith('--')) {
        return fail(arg === '--file' ? '--file 需要一个测试文件路径' : `${arg} 需要一个名字`)
      }
      const key = arg === '--file' ? 'files' : arg === '--controller' ? 'controllers' : 'resources'
      options[key]!.push(value)
    } else if (arg === '--case') {
      const value = argv[++i] ?? ''
      const parsed = Number(value)
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed)) {
        return fail('--case 需要一个非负安全整数下标')
      }
      if (!options.caseIndices!.includes(parsed)) {
        options.caseIndices!.push(parsed)
      }
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--jsonl') {
      options.jsonl = true
    } else if (arg === '--list') {
      options.list = true
    } else if (arg === '--version') {
      return { cmd: 'version', config: '', options }
    } else if (arg.startsWith('-')) {
      return fail(`未知参数：${arg}`)
    } else if (positional.length < 2) {
      positional.push(arg)
    } else {
      return fail(`多余的参数：${arg}`)
    }
  }

  if (options.jsonl && (options.json || options.list)) {
    return fail('--jsonl 不能和 --json 或 --list 一起用')
  }
  if (options.list && options.caseIndices!.length > 0) {
    return fail('--list 不支持 --case；请在运行时选择用例')
  }
  if (options.caseIndices!.length > 0 && options.files!.length !== 1) {
    return fail('--case 只能和单个 --file 一起用')
  }
  const cmd = positional[0] ?? 'help'
  if (
    cmd !== 'test' &&
    (options.json ||
      options.jsonl ||
      options.list ||
      options.files!.length > 0 ||
      options.controllers!.length > 0 ||
      options.resources!.length > 0)
  ) {
    return fail('测试参数只能和 test 命令一起用')
  }
  return {
    cmd,
    config: positional[1] ?? path.join(process.cwd(), 'maatools.config.mts'),
    options
  }
}
