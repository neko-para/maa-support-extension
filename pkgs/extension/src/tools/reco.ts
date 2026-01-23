import * as vscode from 'vscode'

import { logger } from '@mse/utils'

import { setupFixedController } from './utils'

let prevTask: string | undefined = undefined

export async function performReco(image: ArrayBuffer, resources: string[]): Promise<string | null> {
  const ctrl = await setupFixedController(image)

  if (!ctrl) {
    logger.error('quick reco ctrl create failed')
    return null
  }

  const res = new maa.Resource()
  for (const resource of resources) {
    await res.post_bundle(resource).wait()
  }
  if (!res.loaded) {
    logger.error('quick reco res create failed')
    return null
  }

  const tasks = res.node_list
  if (!tasks) {
    logger.error('quick reco res no task')
    return null
  }

  tasks.sort()
  if (prevTask) {
    const prevIdx = tasks.findIndex(x => x === prevTask)
    if (prevIdx !== -1) {
      tasks.splice(prevIdx, 1)
      tasks.unshift(prevTask)
    }
  }
  const task = await vscode.window.showQuickPick(tasks)
  if (!task) {
    return null
  }

  prevTask = task

  const tasker = new maa.Tasker()
  tasker.controller = ctrl
  tasker.resource = res
  if (!tasker.inited) {
    logger.error('quick reco tasker create failed')
    return null
  }

  let result: string | null = null

  res.register_custom_action('@mse/action', async self => {
    logger.info('quick reco action called')
    const detail = await self.context.run_recognition(task, image)
    if (detail?.hit) {
      const presp = {
        ...detail
      } as Partial<typeof detail>
      delete presp.draws
      delete presp.raw
      result = JSON.stringify(presp)
    }
    return true
  })

  await tasker
    .post_task('@mse/action', {
      '@mse/action': {
        action: 'Custom',
        custom_action: '@mse/action'
      }
    })
    .wait()

  logger.info('quick reco destroy')

  tasker.destroy()
  res.destroy()
  ctrl.destroy()

  return result
}
