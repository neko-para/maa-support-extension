import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as workerpool from 'workerpool'

import { loadMaa, makeFakeController, toArrayBuffer } from '../utils/maa'
import type { RecoJob, RecoJobOutcome, RecoResult } from './types'

await loadMaa(
  process.env.MAAFW_MODULE_PATH,
  path.join(process.env.MAAFW_LOG_DIR, `maa-${process.env.MAATOOLS_POOL_ID}-${process.pid}`)
)

const stdoutLevels = ['Off', 'Fatal', 'Error', 'Warn', 'Info', 'Debug', 'Trace', 'All'] as const
type MaaStdoutLevel = (typeof stdoutLevels)[number]
if (
  process.env.MAAFW_STDOUT_LEVEL &&
  stdoutLevels.includes(process.env.MAAFW_STDOUT_LEVEL as MaaStdoutLevel)
) {
  maa.Global.stdout_level = process.env.MAAFW_STDOUT_LEVEL as MaaStdoutLevel
}

let inst: maa.Tasker | undefined = undefined
const taskQueue: ((ctx: maa.Context) => Promise<void>)[] = []
let taskAddResolve: () => void = () => {}

async function setup() {
  const ctrl = await makeFakeController()
  const res = new maa.Resource()
  for (const full of process.env.MAAFW_RESOURCE_PATHS.split(path.delimiter)) {
    await res.post_bundle(full).wait()
  }
  inst = new maa.Tasker()
  inst.resource = res
  inst.controller = ctrl

  res.register_custom_action('@mse/action', async self => {
    while (true) {
      while (taskQueue.length > 0) {
        const task = taskQueue.shift()!
        await task(self.context)
      }
      await new Promise<void>(resolve => {
        taskAddResolve = resolve
      })
      if (taskQueue.length === 0) {
        break
      }
    }
    return true
  })

  inst!.post_task('@mse/action', {
    '@mse/action': {
      action: 'Custom',
      custom_action: '@mse/action'
    }
  })
}

async function performReco(job: RecoJob): Promise<RecoJobOutcome> {
  if (!inst) {
    await setup()
  }

  // 只累计读图和识别工作，排除 worker 初始化与任务队列中的等待。
  const readStartedAt = performance.now()
  let image: ArrayBuffer
  try {
    image = toArrayBuffer(await fs.readFile(job.imagePath))
  } catch (error) {
    console.error(error)
    return { results: [], durationMs: performance.now() - readStartedAt }
  }
  let durationMs = performance.now() - readStartedAt
  const results: RecoResult[] = []
  const { promise, resolve } = Promise.withResolvers<void>()

  taskQueue.push(async context => {
    const startedAt = performance.now()
    try {
      for (const node of job.nodes) {
        try {
          const detail = await context.run_recognition(node, image)
          results.push({
            imagePath: job.imagePath,
            imagePathRaw: job.imagePathRaw,
            node,
            hit: !!detail?.hit,
            detail,
            pid: process.pid
          })
        } catch (error) {
          // 缺失节点由 evaluateCase 记为 no-result，不能让队列等待永不结束。
          console.error(error)
        }
      }
    } finally {
      durationMs += performance.now() - startedAt
      resolve()
    }
  })
  taskAddResolve()
  await promise

  return { results, durationMs }
}

workerpool.worker(
  {
    performReco
  },
  {
    onTerminate: () => {
      taskAddResolve()
    }
  }
)
