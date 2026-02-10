import * as fs from 'fs/promises'
import * as path from 'path'
import * as workerpool from 'workerpool'

import type { RecoJob, RecoResult } from './recoTypes'
import { makeFakeController, toArrayBuffer } from './utils'

module.paths.unshift(process.env.MAAFW_MODULE_PATH!)
require('@maaxyz/maa-node')
if (process.env.MAAFW_SILENCE_STDOUT === '1') {
  maa.Global.stdout_level = 'Off'
}

let inst: maa.Tasker | undefined = undefined
const taskQueue: ((ctx: maa.Context) => Promise<void>)[] = []
let taskAddResolve: () => void = () => {}

async function setup() {
  const ctrl = await makeFakeController()
  const res = new maa.Resource()
  for (const full of process.env.MAAFW_RESOURCE_PATHS!.split(path.delimiter)) {
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

async function performReco(job: RecoJob) {
  if (!inst) {
    await setup()
  }

  const image = toArrayBuffer(await fs.readFile(job.imagePath))
  const result: RecoResult[] = []

  const { promise, resolve } = Promise.withResolvers<void>()

  taskQueue.push(async context => {
    for (const node of job.nodes) {
      const detail = await context.run_recognition(node, image)
      result.push({
        imagePath: job.imagePath,
        imagePathRaw: job.imagePathRaw,
        node: node,
        hit: !!detail?.hit,
        detail
      })
    }
    resolve()
  })
  taskAddResolve()
  await promise

  return result
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
