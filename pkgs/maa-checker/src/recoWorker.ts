import * as workerpool from 'workerpool'

import type { AbsolutePath } from '@mse/pipeline-manager'

import type { RecoJob, RecoResult } from './recoTypes'
import { makeFakeController, toArrayBuffer } from './utils'

async function performReco(job: RecoJob, paths: AbsolutePath[]) {
  if (!globalThis.maa) {
    module.paths.unshift(process.env.MAAFW_MODULE_PATH!)
    require('@maaxyz/maa-node')
    if (process.env.MAAFW_SILENCE_STDOUT === '1') {
      maa.Global.stdout_level = 'Off'
    }
  }

  const image = toArrayBuffer(Buffer.from(job.image, 'base64'))

  const ctrl = await makeFakeController()
  const res = new maa.Resource()
  for (const full of paths) {
    await res.post_bundle(full).wait()
  }

  const result: RecoResult[] = []

  res.register_custom_action('@mse/action', async self => {
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
  })

  const inst = new maa.Tasker()
  inst.resource = res
  inst.controller = ctrl

  await inst
    .post_task('@mse/action', {
      '@mse/action': {
        action: 'Custom',
        custom_action: '@mse/action'
      }
    })
    .wait()

  inst.destroy()
  res.destroy()
  ctrl.destroy()

  return result
}

workerpool.worker({
  performReco
})
