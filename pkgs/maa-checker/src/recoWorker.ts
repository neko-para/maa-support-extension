import path from 'path'
import * as workerpool from 'workerpool'

import type { RecoJob, RecoResult } from './recoTypes'
import { makeFakeController, toArrayBuffer } from './utils'

module.paths.unshift(process.env.MAAFW_MODULE_PATH!)
require('@maaxyz/maa-node')
if (process.env.MAAFW_SILENCE_STDOUT === '1') {
  maa.Global.stdout_level = 'Off'
}

let inst: maa.Tasker | undefined = undefined
let action: maa.CustomActionCallback = () => {
  return true
}

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
    return action.call(self, self)
  })
}

async function performReco(job: RecoJob) {
  if (!inst) {
    await setup()
  }

  const image = toArrayBuffer(Buffer.from(job.image, 'base64'))
  const result: RecoResult[] = []

  action = async self => {
    for (const node of job.nodes) {
      const detail = await self.context.run_recognition(node, image)
      result.push({
        imagePath: job.imagePath,
        imagePathRaw: job.imagePathRaw,
        node: node,
        hit: !!detail?.hit,
        detail
      })
    }

    return true
  }

  await inst!
    .post_task('@mse/action', {
      '@mse/action': {
        action: 'Custom',
        custom_action: '@mse/action'
      }
    })
    .wait()

  return result
}

workerpool.worker({
  performReco
})
