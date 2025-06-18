import * as vscode from 'vscode'

import { logger } from '@mse/utils'

import { maa } from '../maa'

let prevTask: string | undefined = undefined

export async function performReco(image: ArrayBuffer, resources: string[]): Promise<string | null> {
  const ctrl = new maa.CustomController(
    new (class extends maa.CustomControllerActorDefaultImpl {
      connect() {
        return true
      }

      request_uuid() {
        return '0'
      }

      screencap() {
        return image
      }
    })()
  )
  await ctrl.post_connection().wait()
  if (!ctrl.connected) {
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

  const tasks = res.task_list
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
  tasker.bind(ctrl)
  tasker.bind(res)
  if (!tasker.inited) {
    logger.error('quick reco tasker create failed')
    return null
  }

  let result: string | null = null

  res.register_custom_action('@mse/action', async self => {
    logger.info('quick reco action called')
    const resp = await self.context.run_recognition(task, image)
    logger.info(`quick reco reco done, resp ${JSON.stringify(resp)}`)
    if (resp) {
      const presp = {
        ...resp
      } as Partial<typeof resp>
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
